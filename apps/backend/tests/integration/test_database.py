from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from invoiceflow.core.database import database_is_ready

pytestmark = pytest.mark.integration


def test_postgresql_session_preserves_exact_numeric_values(session):
    # Arrange
    session.execute(text("CREATE TABLE amounts (amount NUMERIC(18, 2) NOT NULL)"))
    amount = Decimal("12915.00")

    # Act
    session.execute(text("INSERT INTO amounts VALUES (:amount)"), {"amount": amount})
    session.commit()
    stored = session.execute(text("SELECT amount FROM amounts")).scalar_one()

    # Assert
    assert isinstance(stored, Decimal)
    assert stored == amount
    assert database_is_ready(session)


def test_closing_a_session_rolls_back_uncommitted_writes(isolated_connection):
    # Arrange
    isolated_connection.execute(text("CREATE TABLE writes (id INTEGER PRIMARY KEY)"))
    isolated_connection.commit()

    # Act
    with Session(isolated_connection) as session:
        session.execute(text("INSERT INTO writes VALUES (1)"))

    # Assert
    assert isolated_connection.execute(text("SELECT count(*) FROM writes")).scalar_one() == 0
