
import { z } from "zod";
import {
  createMcpServer,
  getMcpContext,
  jsonResult,
  errorResult,
  requireWriteRole,
  startMcpServer,
} from "./shared.js";

const server = createMcpServer("ledger");

server.registerTool(
  "get_balance",
  {
    description: "Get a synthetic customer's account balance.",
    inputSchema: {
      customer_ref: z.string().min(3).max(100),
    },
  },
  async ({ customer_ref }) => {
    try {
      const { supabase, tenantId } = await getMcpContext();

      const { data, error } = await supabase
        .from("ledger_accounts")
        .select("id, customer_ref, balance")
        .eq("tenant_id", tenantId)
        .eq("customer_ref", customer_ref)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Customer account not found");

      return jsonResult({
        customerRef: data.customer_ref,
        balance: Number(data.balance),
        currency: "USD",
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "issue_refund",
  {
    description:
      "Create a pending refund request. The policy gateway must authorize this action before execution.",
    inputSchema: {
      customer_ref: z.string().min(3).max(100),
      amount: z.number().positive(),
      reason: z.string().min(5).max(500),
    },
  },
  async ({ customer_ref, amount, reason }) => {
    try {
      const { supabase, tenantId, role } = await getMcpContext();
      requireWriteRole(role);

      const { data: account, error: accountError } = await supabase
        .from("ledger_accounts")
        .select("id, balance")
        .eq("tenant_id", tenantId)
        .eq("customer_ref", customer_ref)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!account) throw new Error("Customer account not found");

      if (amount > Number(account.balance)) {
        throw new Error("Refund amount exceeds available account balance");
      }

      const { data: refund, error } = await supabase
        .from("ledger_refunds")
        .insert({
          account_id: account.id,
          amount,
          status: "pending",
        })
        .select("id, amount, status, created_at")
        .single();

      if (error) throw error;

      return jsonResult({
        message: "Refund request created. Approval is still required.",
        refund,
        customerRef: customer_ref,
        reason,
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

await startMcpServer(server);
