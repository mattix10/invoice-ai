import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from pydantic import ValidationError

from invoiceflow.modules.intake.schemas import DeclaredTotals, DraftItem
from invoiceflow.modules.intake.suggestion_schemas import FieldProposal, SuggestionSource

LABELS = {
    "vendor": "Vendor",
    "supplierInvoiceNumber": "Invoice number",
    "issued": "Issued",
    "due": "Due",
    "currency": "Currency",
    "vatRate": "VAT rate",
}


def proposal(field, value, page, extraction_version, start, end):
    try:
        return FieldProposal(
            field=field,
            value=value,
            source=SuggestionSource(
                page_number=page.page_number,
                start=start,
                end=end,
                excerpt=page.text[start:end],
                extraction_method=page.extraction_method,
                extraction_version=extraction_version,
            ),
            warnings=[],
        )
    except ValidationError:
        return None


def parse_invoice_layout(page, extraction_version):
    """Offer values from a recognizable text-layer layout, with source spans."""
    text = page.text
    proposals = []

    def add(field, value, match, group=1):
        candidate = proposal(
            field, value, page, extraction_version, match.start(group), match.end(group)
        )
        if candidate:
            proposals.append(candidate)

    for field, label in (
        ("supplierInvoiceNumber", "Invoice number"),
        ("issued", "Date of issue"),
        ("due", "Date due"),
    ):
        matches = list(re.finditer(rf"(?im)^{label}\s*\r?\n([^\r\n]+)$", text))
        if len(matches) != 1:
            continue
        match = matches[0]
        value = match.group(1).strip()
        if field in ("issued", "due"):
            try:
                value = datetime.strptime(value, "%B %d, %Y").date().isoformat()
            except ValueError:
                continue
        add(field, value, match)

    vendor = re.search(
        r"(?im)^Date due[ \t]*\r?\n[^\r\n]+\r?\n([^\r\n]+)\r?\n"
        r"(?:(?!Bill to)[^\r\n]+\r?\n){1,10}Bill to$",
        text,
    )
    if vendor:
        add("vendor", vendor.group(1).strip(), vendor)

    amount = re.search(r"(?im)^(EUR|PLN|USD|GBP) (\d+\.\d{2}) due [^\r\n]+$", text)
    if amount:
        add("currency", amount.group(1), amount)

    item = re.search(
        r"(?im)^Description\r?\nQty\r?\nUnit price\r?\nTax\r?\nAmount\r?\n"
        r"([^\r\n]+)\r?\n([1-9]\d*)\r?\n(\d+\.\d{2})\r?\n"
        r"(\d+(?:\.\d+)?)%\r?\n(\d+\.\d{2})$(?=\r?\nSubtotal\r?$)",
        text,
    )
    if item:
        try:
            quantity = int(item.group(2))
            unit = Decimal(item.group(3))
            rate = Decimal(item.group(4)) / 100
            if unit * quantity == Decimal(item.group(5)) and 0 <= rate <= 1:
                line = DraftItem(
                    position=1, name=item.group(1), quantity=quantity, unit_net=item.group(3)
                )
                add("items", [line], item, 0)
                add("vatRate", format(rate, "f"), item, 4)
        except (ValueError, ValidationError, InvalidOperation):
            pass

    totals = re.search(
        r"(?im)^Subtotal\r?\n(\d+\.\d{2})\r?\nTax\r?\n(\d+\.\d{2})\r?\n"
        r"Total due\r?\n(?:EUR|PLN|USD|GBP) (\d+\.\d{2})$",
        text,
    )
    if totals:
        try:
            if Decimal(totals.group(1)) + Decimal(totals.group(2)) == Decimal(totals.group(3)):
                add(
                    "declaredTotals",
                    DeclaredTotals(net=totals.group(1), vat=totals.group(2), gross=totals.group(3)),
                    totals,
                    0,
                )
        except (ValidationError, InvalidOperation):
            pass
    return proposals


def parse_suggestions(pages, extraction_version: int) -> list[FieldProposal]:
    proposals = []
    found = set()
    for page in pages:
        for field, label in LABELS.items():
            if field in found:
                continue
            match = re.search(rf"(?im)^[ \t]*{re.escape(label)}[ \t]*:[ \t]*([^\r\n]+)", page.text)
            if not match:
                continue
            raw = match.group(1)
            value = raw.strip()
            start = match.start(1) + len(raw) - len(raw.lstrip())
            candidate = proposal(field, value, page, extraction_version, start, start + len(value))
            if candidate:
                proposals.append(candidate)
                found.add(field)
        for candidate in parse_invoice_layout(page, extraction_version):
            if candidate.field not in found:
                proposals.append(candidate)
                found.add(candidate.field)
        if "items" not in found:
            block = re.search(r"(?im)^(?:Item: [^\r\n]+(?:\r?\n|$))+", page.text)
            if block:
                try:
                    items = []
                    for line in block.group().strip().splitlines():
                        position, name, quantity, unit_net = (
                            part.strip() for part in line[6:].split("|")
                        )
                        items.append(
                            DraftItem(
                                position=int(position),
                                name=name,
                                quantity=int(quantity),
                                unit_net=unit_net,
                            )
                        )
                    candidate = proposal(
                        "items", items, page, extraction_version, block.start(), block.end()
                    )
                    if candidate:
                        proposals.append(candidate)
                        found.add("items")
                except (ValueError, ValidationError):
                    pass
        if "declaredTotals" not in found:
            block = re.search(
                r"(?im)^Net: (\d+\.\d{2})\r?\nVAT: (\d+\.\d{2})\r?\nGross: (\d+\.\d{2})", page.text
            )
            if block:
                try:
                    totals = DeclaredTotals(
                        net=block.group(1), vat=block.group(2), gross=block.group(3)
                    )
                    candidate = proposal(
                        "declaredTotals",
                        totals,
                        page,
                        extraction_version,
                        block.start(),
                        block.end(),
                    )
                    if candidate:
                        proposals.append(candidate)
                        found.add("declaredTotals")
                except ValidationError:
                    pass
    return proposals
