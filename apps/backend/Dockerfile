FROM ghcr.io/astral-sh/uv:0.13.6 AS uv
FROM python:3.13-slim

COPY --from=uv /uv /uvx /bin/
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY src ./src
COPY alembic ./alembic
COPY alembic.ini ./
RUN uv sync --locked --no-dev --no-editable \
    && groupadd --system invoiceflow \
    && useradd --system --gid invoiceflow invoiceflow

USER invoiceflow
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=4)"
CMD ["uvicorn", "invoiceflow.main:app", "--host", "0.0.0.0", "--port", "8000"]
