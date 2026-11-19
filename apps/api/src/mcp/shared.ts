
import dotenv from "dotenv";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createUserSupabaseClient } from "../lib/supabase.js";

dotenv.config({
  path: path.resolve(process.cwd(), "apps/api/.env"),
});

export async function getMcpContext() {
  const token = process.env.PROHORI_ACCESS_TOKEN;

  if (!token) {
    throw new Error("PROHORI_ACCESS_TOKEN is required");
  }

  const supabase = createUserSupabaseClient(token);

  const { data: { user }, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Invalid MCP access token");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error("MCP user profile not found");
  }

  return {
    supabase,
    userId: user.id,
    tenantId: profile.tenant_id as string,
    role: profile.role as string,
  };
}

export function createMcpServer(name: string) {
  return new McpServer({
    name,
    version: "1.0.0",
  });
}

export async function startMcpServer(server: McpServer) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server started");
}

export function jsonResult(data: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(data),
    }],
  };
}

export function errorResult(error: unknown) {
  let message = "Tool execution failed";

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null) {
    const details = error as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };

    message = [
      details.message,
      details.code ? `Code: ${details.code}` : "",
      details.details,
      details.hint ? `Hint: ${details.hint}` : "",
    ]
      .filter(Boolean)
      .join(" | ") || JSON.stringify(error);
  } else if (typeof error === "string") {
    message = error;
  }

  console.error("MCP tool error:", message);

  return {
    content: [{
      type: "text" as const,
      text: message,
    }],
    isError: true,
  };
}

export function requireWriteRole(role: string) {
  if (!["admin", "operator"].includes(role)) {
    throw new Error("Write operation requires admin or operator role");
  }
}
