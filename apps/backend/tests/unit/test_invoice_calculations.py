from dataclasses import dataclass
from decimal import Decimal

import pytest

from invoiceflow.modules.invoices.calculations import (
    calculate_difference,
    calculate_totals,
    line_net,
)


@dataclass
class Line:
    quantity: int
    unit_net: Decimal


def test_canonical_invoice_and_purchase_order_amounts():
    invoice = calculate_totals(
        [Line(10, Decimal("820.00")), Line(10, Decimal("110.00")), Line(5, Decimal("240.00"))],
        Decimal("0.23"),
        "PLN",
    )
    po = calculate_totals(
        [Line(10, Decimal("770.00")), Line(10, Decimal("110.00")), Line(5, Decimal("240.00"))],
        Decimal("0.23"),
        "PLN",
    )
    difference, percent = calculate_difference(invoice, po)
    assert (invoice.net, invoice.vat, invoice.gross) == tuple(
        map(Decimal, ("10500.00", "2415.00", "12915.00"))
    )
    assert (po.net, po.vat, po.gross) == tuple(map(Decimal, ("10000.00", "2300.00", "12300.00")))
    assert (difference.net, difference.vat, difference.gross, percent) == tuple(
        map(Decimal, ("500.00", "115.00", "615.00", "5.0"))
    )


def test_half_cent_rounds_up_and_zero_baseline_has_no_percentage():
    totals = calculate_totals([Line(1, Decimal("0.05"))], Decimal("0.1"), "PLN")
    zero = calculate_totals([], Decimal("0.1"), "PLN")
    assert totals.vat == Decimal("0.01")
    assert calculate_difference(totals, zero)[1] is None


@pytest.mark.parametrize(
    "quantity,price", [(0, "1.00"), (-1, "1.00"), (1, "-0.01"), (1, "0.001"), (1, "NaN")]
)
def test_invalid_line_values_are_rejected(quantity, price):
    with pytest.raises(ValueError):
        line_net(quantity, Decimal(price))


def test_precision_boundary_and_invalid_rate_currency():
    assert line_net(1, Decimal("9999999999999999.99")) == Decimal("9999999999999999.99")
    with pytest.raises(ValueError):
        line_net(2, Decimal("9999999999999999.99"))
    for rate, currency in [("1.00001", "PLN"), ("1.01", "PLN"), ("0.23", "pln")]:
        with pytest.raises(ValueError):
            calculate_totals([], Decimal(rate), currency)
