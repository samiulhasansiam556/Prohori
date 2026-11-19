
import { z } from "zod";

export type Decision =
  | "allow"
  | "deny"
  | "require_approval";

const conditionSchema = z.object({
  field: z.string(),
  op: z.enum([
    "eq", "gt", "lt", "gte", "lte",
    "in", "regex",
  ]),
  value: z.unknown(),
});

const ruleSchema = z.object({
  tool: z.string().optional(),
  effect: z.enum([
    "allow", "deny", "require_approval",
  ]),
  when: z.array(conditionSchema).default([]),
  reason: z.string().optional(),
});

export type PolicyDocument = {
  description?: string;
  default?: Decision;
  rules: z.infer<typeof ruleSchema>[];
};

function getPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

function compare(
  actual: unknown,
  op: string,
  expected: unknown,
): boolean {
  switch (op) {
    case "eq":
      return actual === expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "regex":
      return typeof actual === "string" &&
        typeof expected === "string" &&
        new RegExp(expected).test(actual);
    default:
      return false;
  }
}

export function evaluatePolicy(input: {
  policy: PolicyDocument;
  toolName: string;
  args: Record<string, unknown>;
  context: Record<string, unknown>;
  permission?: {
    effect: Decision;
    condition_json?: Record<string, unknown>;
  } | null;
}): {
  decision: Decision;
  reason: string;
  matchedRule: number | null;
} {
  const parsed = z.object({
    rules: z.array(ruleSchema),
    default: z.enum([
      "allow", "deny", "require_approval",
    ]).optional(),
  }).safeParse(input.policy);

  if (!parsed.success) {
    return {
      decision: "deny",
      reason: "Invalid policy configuration.",
      matchedRule: null,
    };
  }

  const source = {
    args: input.args,
    context: input.context,
  };

  // First matching policy rule wins.
  for (let index = 0; index < parsed.data.rules.length; index++) {
    const rule = parsed.data.rules[index]!;

    if (rule.tool && rule.tool !== input.toolName) {
      continue;
    }

    const matches = rule.when.every((condition) =>
      compare(
        getPath(source, condition.field),
        condition.op,
        condition.value,
      ),
    );

    if (matches) {
      return {
        decision: rule.effect,
        reason: rule.reason ?? `Matched policy rule ${index + 1}.`,
        matchedRule: index,
      };
    }
  }

  // Agent permissions are explicit grants/restrictions.
  // Missing permissions always deny.
  if (!input.permission) {
    return {
      decision: "deny",
      reason: "No agent permission is configured. Default deny.",
      matchedRule: null,
    };
  }

  const permission = input.permission;
  const condition = permission.condition_json ?? {};

  if (permission.effect === "deny") {
    return {
      decision: "deny",
      reason: "Agent permission denies this tool.",
      matchedRule: null,
    };
  }

  if (
    typeof condition.amount_gt === "number" &&
    Number(input.args.amount) <= condition.amount_gt
  ) {
    return {
      decision: "allow",
      reason: "Amount is within the agent permission threshold.",
      matchedRule: null,
    };
  }

  return {
    decision: permission.effect,
    reason: `Agent permission: ${permission.effect}.`,
    matchedRule: null,
  };
}
