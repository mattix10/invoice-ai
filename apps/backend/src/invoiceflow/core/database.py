from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import MetaData, create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session

from invoiceflow.core.config import Settings


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


def create_database_engine(settings: Settings) -> Engine:
    return create_engine(
        settings.database_url.get_secret_value(),
        pool_pre_ping=True,
        pool_timeout=5,
        connect_args={"connect_timeout": 3},
        hide_parameters=True,
    )


def get_session(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session


DatabaseSession = Annotated[Session, Depends(get_session)]


def database_is_ready(session: Session) -> bool:
    try:
        return session.execute(text("SELECT 1")).scalar_one() == 1
    except SQLAlchemyError:
        return False
