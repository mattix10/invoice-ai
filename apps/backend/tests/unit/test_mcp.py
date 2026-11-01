import asyncio

from mcp import Client

from invoiceflow.mcp_server.server import server


def test_discovery_and_invalid_tools():
    async def exercise():
        async with Client(server) as client:
            tools = await client.list_tools()
            assert {tool.name for tool in tools.tools} == {
                "search_invoices",
                "get_invoice",
                "get_reconciliation_evidence",
            }
            search = next(tool for tool in tools.tools if tool.name == "search_invoices")
            assert search.input_schema["properties"]["page_size"]["maximum"] == 20
            assert {"data", "error"} <= search.output_schema["properties"].keys()
            result = await client.call_tool("get_invoice", {"invoice_id": "bad"})
            assert result.is_error
            result = await client.call_tool("search_invoices", {"page_size": 21})
            assert result.is_error
            result = await client.call_tool("delete_invoice", {"invoice_id": "INV-2026-1042"})
            assert result.is_error

    asyncio.run(exercise())
