import re
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Protocol

CENT = Decimal("0.01")
MAX_MONEY = Decimal("9999999999999999.99")


class Line(Protocol):
    quantity: int
    unit_net: Decimal


@dataclass(frozen=True)
class Totals:
    net: Decimal
    vat: Decimal
    gross: Decimal


def _validate_decimal(value: Decimal, places: int, maximum: Decimal) -> None:
    if (
        not isinstance(value, Decimal)
        or not value.is_finite()
        or value < 0
        or value > maximum
        or value.as_tuple().exponent < -places
    ):
        raise ValueError("Invalid decimal value")


def line_net(quantity: int, unit_net: Decimal) -> Decimal:
    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0:
        raise ValueError("Quantity must be a positive integer")
    _validate_decimal(unit_net, 2, MAX_MONEY)
    try:
        result = (unit_net * quantity).quantize(CENT, rounding=ROUND_HALF_UP)
    except InvalidOperation:
        raise ValueError("Line amount exceeds storage precision") from None
    if result > MAX_MONEY:
        raise ValueError("Line amount exceeds storage precision")
    return result


def calculate_totals(items: Iterable[Line], vat_rate: Decimal, currency: str) -> Totals:
    if not isinstance(currency, str) or not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValueError("Invalid currency")
    _validate_decimal(vat_rate, 4, Decimal("1"))
    try:
        net = sum((line_net(item.quantity, item.unit_net) for item in items), Decimal("0.00"))
        vat = (net * vat_rate).quantize(CENT, rounding=ROUND_HALF_UP)
        gross = net + vat
    except InvalidOperation:
        raise ValueError("Amount exceeds precision") from None
    if gross > MAX_MONEY:
        raise ValueError("Amount exceeds storage precision")
    return Totals(net, vat, gross)


def calculate_difference(
    invoice_totals: Totals, po_totals: Totals
) -> tuple[Totals, Decimal | None]:
    difference = Totals(
        invoice_totals.net - po_totals.net,
        invoice_totals.vat - po_totals.vat,
        invoice_totals.gross - po_totals.gross,
    )
    percent = (
        None
        if po_totals.gross == 0
        else (difference.gross * 100 / po_totals.gross).quantize(
            Decimal("0.1"), rounding=ROUND_HALF_UP
        )
    )
    return difference, percent
