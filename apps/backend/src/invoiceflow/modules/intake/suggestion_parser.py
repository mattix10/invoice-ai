import re

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
