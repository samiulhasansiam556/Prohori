
-- Prohori Step 5: Gateway policy baseline
-- All records and actions are synthetic.

-- Correct support refund threshold.
update public.agent_permissions
set effect = 'require_approval',
    condition_json = '{"amount_gt":100}'::jsonb
where agent_id = '33333333-3333-4333-8333-333333333331'
  and tool_name = 'issue_refund';

-- Intern must remain read-only.
update public.agent_permissions
set effect = 'deny',
    condition_json = '{}'::jsonb
where agent_id = '33333333-3333-4333-8333-333333333332'
  and tool_name in ('issue_refund', 'create_ticket', 'update_ticket');

-- Activate policy version 2.
update public.policies
set active = false
where tenant_id = '11111111-1111-4111-8111-111111111111';

insert into public.policies (
  tenant_id, version, rules_json, active
)
values (
  '11111111-1111-4111-8111-111111111111',
  2,
  '{
    "description": "Prohori gateway baseline policy",
    "default": "deny",
    "rules": [
      {
        "tool": "issue_refund",
        "effect": "deny",
        "when": [
          {"field":"context.agentName","op":"eq","value":"intern-agent"}
        ],
        "reason": "Intern agents cannot issue refunds."
      },
      {
        "tool": "issue_refund",
        "effect": "deny",
        "when": [
          {"field":"args.amount","op":"gt","value":1000}
        ],
        "reason": "Refunds above $1,000 are denied."
      },
      {
        "tool": "issue_refund",
        "effect": "require_approval",
        "when": [
          {"field":"args.amount","op":"gt","value":100}
        ],
        "reason": "Refunds above $100 require human approval."
      }
    ]
  }'::jsonb,
  true
)
on conflict (tenant_id, version) do nothing;
