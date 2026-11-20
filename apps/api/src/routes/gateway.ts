import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { createUserSupabaseClient } from "../lib/supabase.js";
import { evaluatePolicy } from "../lib/policy-engine.js";

export const gatewayRouter = Router();

const TENANT_FALLBACK = "11111111-1111-4111-8111-111111111111";

const toolServers: Record<string, string> = {
  search_policy: "policy-kb",
  get_balance: "ledger",
  issue_refund: "ledger",
  create_ticket: "ticketing",
  update_ticket: "ticketing",
};

const toolSchema = z.object({
  agentId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  args: z.record(z.string(), z.unknown()).default({}),
});

const approvalSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(3).max(1000),
});

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
      .replace(/(?<![\d.])(?:\+?\d[\d\s()-]{8,}\d)(?![\d.])/g, "[PHONE]");
  }

  if (Array.isArray(value)) return value.map(redact);

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]));
  }

  return value;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

async function writeAudit(
  supabase: ReturnType<typeof createUserSupabaseClient>,
  tenantId: string,
  actor: string,
  action: string,
  entity: string,
  entityId: string,
  details: Record<string, unknown>
) {
  const { data: previous, error: previousError } = await supabase
    .from("audit_log")
    .select("hash")
    .eq("tenant_id", tenantId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) throw previousError;

  const prevHash = previous?.hash ?? "";

  const entry = {
    tenant_id: tenantId,
    actor,
    action,
    entity,
    entity_id: entityId,
    details_json: redact(details),
  };

  const hash = createHash("sha256")
    .update(prevHash + canonical(entry))
    .digest("hex");

  const { error } = await supabase.from("audit_log").insert({
    ...entry,
    prev_hash: prevHash || null,
    hash,
  });

  if (error) throw error;
}

async function addTrace(
  supabase: ReturnType<typeof createUserSupabaseClient>,
  input: {
    runId: string;
    stepNo: number;
    type: "tool_call" | "policy" | "approval" | "guardrail";
    toolName?: string;
    args?: unknown;
    result?: unknown;
    decision?: string;
    reason?: string;
    latencyMs?: number;
  }
) {
  const { error } = await supabase.from("trace_steps").insert({
    run_id: input.runId,
    step_no: input.stepNo,
    type: input.type,
    tool_name: input.toolName ?? null,
    args_redacted: redact(input.args ?? null),
    result_redacted: redact(input.result ?? null),
    decision: input.decision ?? null,
    reason: input.reason ?? null,
    latency_ms: input.latencyMs ?? null,
  });

  if (error) throw error;
}






async function getNextStepNo(
  supabase: ReturnType<typeof createUserSupabaseClient>,
  runId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("trace_steps")
    .select("step_no")
    .eq("run_id", runId)
    .order("step_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return (data?.step_no ?? 0) + 1;
}

async function callMcpTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  accessToken: string
) {

const cwd = process.cwd();

const root =
  path.basename(cwd) === "api" &&
  path.basename(path.dirname(cwd)) === "apps"
    ? path.resolve(cwd, "../..")
    : cwd;

const sourceFile = path.resolve(
  root,
  "apps/api/src/mcp",
  `${serverName}.ts`
);

const compiledFile = path.resolve(
  root,
  "apps/api/dist/mcp",
  `${serverName}.js`
);

const tsxCli = path.resolve(
  root,
  "node_modules/tsx/dist/cli.mjs"
);
  let command: string;
  let commandArgs: string[];

  if (process.env.NODE_ENV === "production" && existsSync(compiledFile)) {
    command = process.execPath;
    commandArgs = [compiledFile];
  } else {
    command = process.execPath;
    commandArgs = [tsxCli, sourceFile];
  }

  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );

  env.PROHORI_ACCESS_TOKEN = accessToken;

  const transport = new StdioClientTransport({
    command,
    args: commandArgs,
    cwd: root,
    env,
  });

  const client = new Client({
    name: "prohori-gateway",
    version: "1.0.0",
  });

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    if (result.isError) {
      const errorText = Array.isArray(result.content)
        ? result.content
            .map((item: unknown) => {
              if (typeof item !== "object" || item === null || !("text" in item)) {
                return "";
              }

              return typeof item.text === "string" ? item.text : "";
            })
            .join("\n")
        : "";

      throw new Error(errorText || "MCP tool failed");
    }

    return result;
  } finally {
    await client.close();
  }
}

function hasInjection(value: unknown): boolean {
  const text = JSON.stringify(value).toLowerCase();

  return [
    "ignore previous instructions",
    "ignore all instructions",
    "reveal system prompt",
    "bypass policy",
    "disable safety",
  ].some((pattern) => text.includes(pattern));
}

async function getActivePolicy(
  supabase: ReturnType<typeof createUserSupabaseClient>,
  tenantId: string
) {
  const { data, error } = await supabase
    .from("policies")
    .select("id, version, rules_json")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function executeApprovedAction(
  supabase: ReturnType<typeof createUserSupabaseClient>,
  accessToken: string,
  approval: any,
  run: any
) {
  const action = approval.requested_action as {
    toolName: string;
    args: Record<string, unknown>;
    agentId: string;
  };

  const serverName = toolServers[action.toolName];
  if (!serverName) throw new Error("Unsupported tool.");

  const started = Date.now();
  const result = await callMcpTool(serverName, action.toolName, action.args, accessToken);

  const safeResult = redact(result);

  if (action.toolName === "issue_refund") {
    const refundId = (result as any).structuredContent?.refund?.id;

    if (refundId) {
      const { error } = await supabase
        .from("ledger_refunds")
        .update({ status: "completed" })
        .eq("id", refundId);

      if (error) throw error;
    }
  }

  const { data: previous } = await supabase
    .from("trace_steps")
    .select("step_no")
    .eq("run_id", run.id)
    .order("step_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  await addTrace(supabase, {
    runId: run.id,
    stepNo: (previous?.step_no ?? 0) + 1,
    type: "tool_call",
    toolName: action.toolName,
    args: action.args,
    result: safeResult,
    decision: "allow",
    reason: "Human approval granted.",
    latencyMs: Date.now() - started,
  });

  await supabase
    .from("runs")
    .update({
      status: "completed",
      final_output: JSON.stringify(safeResult),
      ended_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  return safeResult;
}

// Execute a governed MCP tool call.
gatewayRouter.post("/tools/:toolName", requireAuth, async (req, res) => {
  const parsed = toolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid gateway request.",
      errors: parsed.error.flatten(),
    });
  }

  const toolNameParam = req.params.toolName;
  const toolName = Array.isArray(toolNameParam) ? toolNameParam[0] : toolNameParam;
  const serverName = toolName ? toolServers[toolName] : undefined;

  if (!toolName || !serverName) {
    return res.status(404).json({
      success: false,
      message: "Unknown tool.",
    });
  }

  const user = res.locals.authUser;
  const accessToken = req.headers.authorization!.slice(7);
  const supabase = createUserSupabaseClient(accessToken);
 const { agentId, args, runId: parentRunId } = parsed.data;

  try {
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, name, status, tenant_id")
      .eq("id", agentId)
      .eq("tenant_id", user.tenantId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found.",
      });
    }

    if (agent.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Agent is quarantined or disabled.",
      });
    }

    // Budget check.
    const { data: budget } = await supabase
      .from("budgets")
      .select("max_calls_day")
      .eq("agent_id", agentId)
      .maybeSingle();

    if (budget) {
      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("runs")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .gte("started_at", since.toISOString());

      if ((count ?? 0) >= budget.max_calls_day) {
        return res.status(429).json({
          success: false,
          decision: "deny",
          reason: "Daily agent call budget exceeded.",
        });
      }
    }

    // Input guardrail.
    if (hasInjection(args)) {
      return res.status(400).json({
        success: false,
        decision: "deny",
        reason: "Input guardrail blocked a suspected prompt injection.",
      });
    }

    const { data: permission } = await supabase
      .from("agent_permissions")
      .select("effect, condition_json")
      .eq("agent_id", agentId)
      .eq("tool_name", toolName)
      .maybeSingle();

    const policy = await getActivePolicy(supabase, user.tenantId);

    const evaluation = evaluatePolicy({
      policy: policy?.rules_json ?? {
        default: "deny",
        rules: [],
      },
      toolName,
      args,
      context: {
        agentId,
        agentName: agent.name,
        role: user.role,
      },
      permission: permission ?? null,
    });
let run: { id: string };
let ownsRun = false;

if (parentRunId) {
  const { data: parentRun, error: parentRunError } = await supabase
    .from("runs")
    .select("id, agent_id, status")
    .eq("id", parentRunId)
    .eq("agent_id", agentId)
    .eq("tenant_id", user.tenantId)
    .maybeSingle();

  if (parentRunError) throw parentRunError;

  if (!parentRun) {
    return res.status(404).json({
      success: false,
      message: "Parent run not found for this agent and tenant.",
    });
  }

  if (parentRun.status !== "running") {
    return res.status(409).json({
      success: false,
      message: "Parent run is not accepting tool executions.",
    });
  }

  run = { id: parentRun.id };
} else {
  const { data: newRun, error: runError } = await supabase
    .from("runs")
    .insert({
      tenant_id: user.tenantId,
      agent_id: agentId,
      user_input: JSON.stringify(
        redact({
          toolName,
          args,
        })
      ),
      status:
        evaluation.decision === "require_approval"
          ? "waiting_approval"
          : evaluation.decision === "deny"
            ? "blocked"
            : "running",
    })
    .select("id")
    .single();

  if (runError || !newRun) {
    throw runError ?? new Error("Run creation failed.");
  }

  run = { id: newRun.id };
  ownsRun = true;
}
    await addTrace(supabase, {
      runId: run.id,
      stepNo: await getNextStepNo(supabase, run.id),
      type: "policy",
      toolName,
      args,
      decision: evaluation.decision,
      reason: evaluation.reason,
    });

    await writeAudit(
      supabase,
      user.tenantId,
      user.id,
      `gateway.${evaluation.decision}`,
      "run",
      run.id,
      {
        agentId,
        toolName,
        policyVersion: policy?.version ?? null,
        reason: evaluation.reason,
      }
    );

    if (evaluation.decision === "deny") {
      return res.status(403).json({
        success: false,
        runId: run.id,
        decision: "deny",
        reason: evaluation.reason,
        policyVersion: policy?.version ?? null,
      });
    }

    if (evaluation.decision === "require_approval") {
      const { data: approval, error } = await supabase
        .from("approvals")
        .insert({
          run_id: run.id,
          requested_action: {
            agentId,
            toolName,
            args,
          },
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(202).json({
        success: true,
        decision: "require_approval",
        reason: evaluation.reason,
        runId: run.id,
        approvalId: approval.id,
        policyVersion: policy?.version ?? null,
      });
    }

    const started = Date.now();

    try {
      const result = await callMcpTool(serverName, toolName, args, accessToken);

      const safeResult = redact(result);

      await addTrace(supabase, {
        runId: run.id,
       stepNo: await getNextStepNo(supabase, run.id),
        type: "tool_call",
        toolName,
        args,
        result: safeResult,
        decision: "allow",
        reason: "Policy allowed tool execution.",
        latencyMs: Date.now() - started,
      });

      if (ownsRun) {
        const { error: updateError } = await supabase
          .from("runs")
          .update({
            status: "completed",
            final_output: JSON.stringify(safeResult),
            ended_at: new Date().toISOString(),
          })
          .eq("id", run.id);

        if (updateError) throw updateError;
      }

      await writeAudit(supabase, user.tenantId, user.id, "gateway.tool_executed", "run", run.id, {
        toolName,
        agentId,
      });

      return res.json({
        success: true,
        decision: "allow",
        runId: run.id,
        result: safeResult,
        policyVersion: policy?.version ?? null,
      });
    } catch (error) {
      console.error("[GATEWAY EXECUTION ERROR]", error);

           if (ownsRun) {
        await supabase
          .from("runs")
          .update({
            status: "failed",
            ended_at: new Date().toISOString(),
          })
          .eq("id", run.id);
      }

      throw error;
    }
  } catch (error) {
    console.error("Gateway error:", error);

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Gateway execution failed.",
    });
  }
});

// Human approval / rejection.
gatewayRouter.post(
  "/approvals/:approvalId/decision",
  requireAuth,
  requireRole("admin", "operator"),
  async (req, res) => {
    const parsed = approvalSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval decision.",
        errors: parsed.error.flatten(),
      });
    }

    const user = res.locals.authUser;
    const accessToken = req.headers.authorization!.slice(7);
    const supabase = createUserSupabaseClient(accessToken);

    try {
      const { data: approval, error } = await supabase
        .from("approvals")
        .select("*")
        .eq("id", req.params.approvalId)
        .eq("status", "pending")
        .single();

      if (error || !approval) {
        return res.status(404).json({
          success: false,
          message: "Pending approval not found.",
        });
      }

      const { data: run } = await supabase
        .from("runs")
        .select("*")
        .eq("id", approval.run_id)
        .eq("tenant_id", user.tenantId)
        .single();

      if (!run) {
        return res.status(404).json({
          success: false,
          message: "Run not found.",
        });
      }

      const { data: agent } = await supabase
        .from("agents")
        .select("tenant_id")
        .eq("id", run.agent_id)
        .eq("tenant_id", user.tenantId)
        .single();

      if (!agent) {
        return res.status(403).json({
          success: false,
          message: "Approval is outside your tenant.",
        });
      }

      const { decision, reason } = parsed.data;

      const { error: updateError } = await supabase
        .from("approvals")
        .update({
          status: decision,
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          reason,
        })
        .eq("id", approval.id)
        .eq("status", "pending");

      if (updateError) throw updateError;

      if (decision === "rejected") {
        await supabase
          .from("runs")
          .update({
            status: "blocked",
            ended_at: new Date().toISOString(),
          })
          .eq("id", run.id);

        await addTrace(supabase, {
          runId: run.id,
         stepNo: await getNextStepNo(supabase, run.id),
          type: "approval",
          decision: "rejected",
          reason,
        });

        await writeAudit(
          supabase,
          user.tenantId,
          user.id,
          "approval.rejected",
          "approval",
          approval.id,
          { runId: run.id, reason }
        );

        return res.json({
          success: true,
          status: "rejected",
          runId: run.id,
        });
      }

      const result = await executeApprovedAction(supabase, accessToken, approval, run);

      await writeAudit(
        supabase,
        user.tenantId,
        user.id,
        "approval.approved",
        "approval",
        approval.id,
        { runId: run.id, reason }
      );

      return res.json({
        success: true,
        status: "approved",
        runId: run.id,
        result,
      });
    } catch (error) {
      console.error("Approval error:", error);

      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Approval processing failed.",
      });
    }
  }
);

// Create a new versioned policy.
gatewayRouter.post("/policies", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = z
    .object({
      description: z.string().optional(),
      default: z.enum(["allow", "deny", "require_approval"]).default("deny"),
      rules: z.array(
        z.object({
          tool: z.string().optional(),
          effect: z.enum(["allow", "deny", "require_approval"]),
          when: z
            .array(
              z.object({
                field: z.string(),
                op: z.enum(["eq", "gt", "lt", "gte", "lte", "in", "regex"]),
                value: z.unknown(),
              })
            )
            .default([]),
          reason: z.string().optional(),
        })
      ),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid policy document.",
      errors: parsed.error.flatten(),
    });
  }

  const user = res.locals.authUser;
  const supabase = createUserSupabaseClient(req.headers.authorization!.slice(7));

  try {
    const current = await getActivePolicy(supabase, user.tenantId);
    const version = (current?.version ?? 0) + 1;

    const { error: deactivateError } = await supabase
      .from("policies")
      .update({ active: false })
      .eq("tenant_id", user.tenantId)
      .eq("active", true);

    if (deactivateError) throw deactivateError;

    const { data, error } = await supabase
      .from("policies")
      .insert({
        tenant_id: user.tenantId,
        version,
        rules_json: parsed.data,
        active: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    await writeAudit(
      supabase,
      user.tenantId,
      user.id,
      "policy.version_created",
      "policy",
      data.id,
      { version }
    );

    return res.status(201).json({
      success: true,
      policy: data,
    });
  } catch (error) {
    console.error("Policy version error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not create policy version.",
    });
  }
});

// Dry-run: replay recent tool traces against a draft policy.
gatewayRouter.post(
  "/policies/dry-run",
  requireAuth,
  requireRole("admin", "operator"),
  async (req, res) => {
    const parsed = z
      .object({
        policy: z.object({
          default: z.enum(["allow", "deny", "require_approval"]).default("deny"),
          rules: z.array(
            z.object({
              tool: z.string().optional(),
              effect: z.enum(["allow", "deny", "require_approval"]),
              when: z
                .array(
                  z.object({
                    field: z.string(),
                    op: z.enum(["eq", "gt", "lt", "gte", "lte", "in", "regex"]),
                    value: z.unknown(),
                  })
                )
                .default([]),
              reason: z.string().optional(),
            })
          ),
        }),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid draft policy.",
      });
    }

    const user = res.locals.authUser;
    const supabase = createUserSupabaseClient(req.headers.authorization!.slice(7));

    try {
      const { data: traces, error } = await supabase
        .from("trace_steps")
        .select("run_id, tool_name, args_redacted, decision")
        .eq("type", "tool_call")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const differences = [];

      for (const trace of traces ?? []) {
        const { data: run } = await supabase
          .from("runs")
          .select("agent_id")
          .eq("id", trace.run_id)
          .eq("tenant_id", user.tenantId)
          .maybeSingle();

        if (!run || !trace.tool_name) continue;

        const { data: agent } = await supabase
          .from("agents")
          .select("name")
          .eq("id", run.agent_id)
          .maybeSingle();

        const { data: permission } = await supabase
          .from("agent_permissions")
          .select("effect, condition_json")
          .eq("agent_id", run.agent_id)
          .eq("tool_name", trace.tool_name)
          .maybeSingle();

        const result = evaluatePolicy({
          policy: parsed.data.policy,
          toolName: trace.tool_name,
          args: (trace.args_redacted ?? {}) as Record<string, unknown>,
          context: {
            agentId: run.agent_id,
            agentName: agent?.name ?? "",
          },
          permission: permission ?? null,
        });

        if (result.decision !== trace.decision) {
          differences.push({
            runId: trace.run_id,
            toolName: trace.tool_name,
            previousDecision: trace.decision,
            draftDecision: result.decision,
            reason: result.reason,
          });
        }
      }

      return res.json({
        success: true,
        sampled: traces?.length ?? 0,
        changed: differences.length,
        differences,
      });
    } catch (error) {
      console.error("Policy dry-run error:", error);
      return res.status(500).json({
        success: false,
        message: "Policy dry-run failed.",
      });
    }
  }
);

// Read active policy.
gatewayRouter.get("/policies", requireAuth, async (req, res) => {
  const user = res.locals.authUser;
  const supabase = createUserSupabaseClient(req.headers.authorization!.slice(7));

  try {
    const policy = await getActivePolicy(supabase, user.tenantId);
    return res.json({ success: true, policy });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Could not load active policy.",
    });
  }
});
