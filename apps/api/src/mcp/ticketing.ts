
import { z } from "zod";
import {
  createMcpServer,
  getMcpContext,
  jsonResult,
  errorResult,
  requireWriteRole,
  startMcpServer,
} from "./shared.js";

const server = createMcpServer("ticketing");

server.registerTool(
  "create_ticket",
  {
    description: "Create a synthetic customer support ticket.",
    inputSchema: {
      subject: z.string().min(3).max(200),
      body: z.string().min(5).max(5000),
    },
  },
  async ({ subject, body }) => {
    try {
      const { supabase, tenantId, role } = await getMcpContext();
      requireWriteRole(role);

      const { data, error } = await supabase
        .from("tickets")
        .insert({
          tenant_id: tenantId,
          subject,
          body,
          status: "open",
        })
        .select("id, subject, body, status, created_at")
        .single();

      if (error) throw error;

      return jsonResult({
        message: "Ticket created successfully",
        ticket: data,
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "update_ticket",
  {
    description: "Update a ticket's status within the authenticated tenant.",
    inputSchema: {
      id: z.string().uuid(),
      status: z.enum(["open", "in_progress", "resolved", "closed"]),
    },
  },
  async ({ id, status }) => {
    try {
      const { supabase, tenantId, role } = await getMcpContext();
      requireWriteRole(role);

      const { data, error } = await supabase
        .from("tickets")
        .update({ status })
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select("id, subject, status")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Ticket not found");

      return jsonResult({
        message: "Ticket updated successfully",
        ticket: data,
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

await startMcpServer(server);
