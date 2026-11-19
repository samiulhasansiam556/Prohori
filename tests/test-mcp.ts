import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = process.cwd();

dotenv.config({
  path: path.resolve(root, "apps/api/.env"),
});

if (!process.env.PROHORI_ACCESS_TOKEN) {
  throw new Error("Set PROHORI_ACCESS_TOKEN before running the MCP tests");
}

const tsxCli = path.resolve(root, "node_modules/tsx/dist/cli.mjs");

const env = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
);

async function connectServer(name: string, file: string) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCli, path.resolve(root, file)],
    cwd: root,
    env,
  });

  const client = new Client({
    name: "prohori-mcp-test",
    version: "1.0.0",
  });

  await client.connect(transport);

  const { tools } = await client.listTools();

  console.log(
    `\n${name} tools:`,
    tools.map((tool) => tool.name)
  );

  return { client, transport };
}

function parseResult(result: { content: Array<{ type: string; text?: string }> }) {
  const text = result.content.find((item) => item.type === "text")?.text;

  if (!text) throw new Error("MCP tool returned no text");

  return JSON.parse(text) as Record<string, any>;
}

async function main() {
  const policy = await connectServer("policy-kb", "apps/api/src/mcp/policy-kb.ts");

  const ledger = await connectServer("ledger", "apps/api/src/mcp/ledger.ts");

  const ticketing = await connectServer("ticketing", "apps/api/src/mcp/ticketing.ts");

  try {
    const policyResult = await policy.client.callTool({
      name: "search_policy",
      arguments: { query: "refund policy", k: 3 },
    });

    console.log("\nPolicy search:", parseResult(policyResult as any));

    const balanceResult = await ledger.client.callTool({
      name: "get_balance",
      arguments: { customer_ref: "SYN-CUST-001" },
    });

    console.log("\nLedger balance:", parseResult(balanceResult as any));

    const ticketResult = await ticketing.client.callTool({
      name: "create_ticket",
      arguments: {
        subject: "[SYNTHETIC] MCP integration test",
        body: "Synthetic ticket created by the Prohori MCP test.",
      },
    });

    const created = parseResult(ticketResult as any);
    console.log("\nTicket created:", created);

    const ticketId = created.ticket?.id;

    if (!ticketId) {
      throw new Error("Ticket creation did not return an ID");
    }

    const updateResult = await ticketing.client.callTool({
      name: "update_ticket",
      arguments: {
        id: ticketId,
        status: "in_progress",
      },
    });

    console.log("\nTicket updated:", parseResult(updateResult as any));

    console.log("\nALL MCP INTEGRATION TESTS PASSED");
  } finally {
    await Promise.all([policy.client.close(), ledger.client.close(), ticketing.client.close()]);
  }
}

main().catch((error) => {
  console.error("MCP TEST FAILED:", error);
  process.exitCode = 1;
});
