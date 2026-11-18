
-- Prohori | Step 1 | Initial database schema
-- All demo records are synthetic.

create extension if not exists vector with schema extensions;

-- 1. Tenants and users
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  role text not null check (role in ('admin', 'operator', 'viewer'))
);

-- 2. Agents and permissions
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  owner text,
  description text,
  model text,
  provider text not null default 'cloud'
    check (provider in ('cloud', 'local')),
  system_prompt_id uuid,
  status text not null default 'active'
    check (status in ('active', 'quarantined', 'disabled')),
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.agent_permissions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  tool_name text not null,
  effect text not null
    check (effect in ('allow', 'deny', 'require_approval')),
  condition_json jsonb not null default '{}'::jsonb,
  unique (agent_id, tool_name)
);

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  version int not null,
  rules_json jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, version)
);

-- 3. Prompt registry
create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null default 1,
  content text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, version)
);

alter table public.agents
  add constraint agents_system_prompt_fk
  foreign key (system_prompt_id)
  references public.prompts(id)
  on delete set null;

-- 4. Runs and traces
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  agent_id uuid not null references public.agents(id),
  user_input text not null,
  final_output text,
  status text not null default 'running'
    check (status in (
      'running', 'waiting_approval', 'completed',
      'failed', 'blocked'
    )),
  total_tokens int not null default 0,
  total_cost_usd numeric(12, 6) not null default 0,
  eval_score numeric(5, 4),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.trace_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  step_no int not null,
  type text not null
    check (type in ('llm', 'tool_call', 'guardrail', 'approval', 'policy')),
  tool_name text,
  args_redacted jsonb,
  result_redacted jsonb,
  decision text,
  reason text,
  latency_ms int,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(12, 6),
  created_at timestamptz not null default now(),
  unique (run_id, step_no)
);

-- 5. Approvals and append-only audit log
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  step_id uuid references public.trace_steps(id),
  requested_action jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  decided_by uuid,
  decided_at timestamptz,
  reason text
);

create table if not exists public.audit_log (
  id bigserial primary key,
  tenant_id uuid not null references public.tenants(id),
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  details_json jsonb not null default '{}'::jsonb,
  prev_hash text,
  hash text not null,
  created_at timestamptz not null default now()
);

-- 6. Evaluations
create table if not exists public.eval_suites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null
    check (kind in ('regression', 'redteam')),
  cases_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.eval_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.runs(id) on delete set null,
  suite text not null,
  metric text not null,
  score numeric(5, 4) not null,
  rationale text,
  created_at timestamptz not null default now()
);

-- 7. Budgets and anomalies
create table if not exists public.budgets (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  max_cost_usd_day numeric(12, 4) not null default 10,
  max_calls_day int not null default 100,
  max_tokens_run int not null default 12000
);

create table if not exists public.anomalies (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id),
  kind text not null,
  severity text not null
    check (severity in ('low', 'medium', 'high', 'critical')),
  details_json jsonb not null default '{}'::jsonb,
  action_taken text,
  created_at timestamptz not null default now()
);

-- 8. Knowledge base (synthetic documents)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  title text not null,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  content text not null,
  embedding extensions.vector,
  metadata jsonb not null default '{}'::jsonb
);

-- 9. Synthetic ledger data
create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  customer_ref text not null,
  balance numeric(14, 2) not null default 0
    check (balance >= 0),
  unique (tenant_id, customer_ref)
);

create table if not exists public.ledger_refunds (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ledger_accounts(id),
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'completed')),
  run_id uuid references public.runs(id),
  created_at timestamptz not null default now()
);

-- 10. Synthetic ticketing data
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  subject text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  body text,
  created_at timestamptz not null default now()
);

-- 11. External agent API keys (only hashes are stored)
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  agent_id uuid not null references public.agents(id),
  key_hash text not null unique,
  label text not null,
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);

-- 12. Useful indexes
create index if not exists idx_agents_tenant
  on public.agents(tenant_id);

create index if not exists idx_runs_tenant_started
  on public.runs(tenant_id, started_at desc);

create index if not exists idx_runs_agent
  on public.runs(agent_id);

create index if not exists idx_trace_steps_run
  on public.trace_steps(run_id, step_no);

create index if not exists idx_approvals_status
  on public.approvals(status);

create index if not exists idx_audit_tenant_created
  on public.audit_log(tenant_id, created_at desc);

create index if not exists idx_documents_tenant
  on public.documents(tenant_id);

create index if not exists idx_tickets_tenant
  on public.tickets(tenant_id);

create index if not exists idx_anomalies_agent_created
  on public.anomalies(agent_id, created_at desc);

-- 13. Synthetic seed data
-- Fixed IDs make the demo records predictable and repeatable.

insert into public.tenants (id, name, region)
values (
  '11111111-1111-4111-8111-111111111111',
  'Prohori Demo Tenant',
  'Singapore'
)
on conflict (id) do nothing;

insert into public.prompts (id, name, version, content, active)
values
(
  '22222222-2222-4222-8222-222222222221',
  'support-agent-system',
  1,
  'You are a synthetic demo support agent. Use only authorized tools.',
  true
),
(
  '22222222-2222-4222-8222-222222222222',
  'intern-agent-system',
  1,
  'You are a restricted demo intern agent. Never perform write actions.',
  true
),
(
  '22222222-2222-4222-8222-222222222223',
  'analyst-agent-system',
  1,
  'You are a read-only demo analyst agent.',
  true
)
on conflict (id) do nothing;

insert into public.agents (
  id, tenant_id, name, owner, description,
  model, provider, system_prompt_id, status
)
values
(
  '33333333-3333-4333-8333-333333333331',
  '11111111-1111-4111-8111-111111111111',
  'support-agent', 'Prohori Team',
  'Synthetic customer support agent with controlled write permissions.',
  'claude-configured-later', 'cloud',
  '22222222-2222-4222-8222-222222222221', 'active'
),
(
  '33333333-3333-4333-8333-333333333332',
  '11111111-1111-4111-8111-111111111111',
  'intern-agent', 'Prohori Team',
  'Synthetic restricted agent with read-only permissions.',
  'claude-configured-later', 'cloud',
  '22222222-2222-4222-8222-222222222222', 'active'
),
(
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'analyst-agent', 'Prohori Team',
  'Synthetic read-only agent for analytics.',
  'claude-configured-later', 'cloud',
  '22222222-2222-4222-8222-222222222223', 'active'
)
on conflict (id) do nothing;

-- Support agent: read tools allowed; refund requires approval.
insert into public.agent_permissions (agent_id, tool_name, effect, condition_json)
values
(
  '33333333-3333-4333-8333-333333333331',
  'search_policy', 'allow', '{}'::jsonb
),
(
  '33333333-3333-4333-8333-333333333331',
  'get_balance', 'allow', '{}'::jsonb
),
(
  '33333333-3333-4333-8333-333333333331',
  'issue_refund', 'require_approval',
  '{"amount_gt": 0}'::jsonb
),
(
  '33333333-3333-4333-8333-333333333331',
  'create_ticket', 'allow', '{}'::jsonb
),
-- Intern agent: read-only.
(
  '33333333-3333-4333-8333-333333333332',
  'search_policy', 'allow', '{}'::jsonb
),
(
  '33333333-3333-4333-8333-333333333332',
  'get_balance', 'allow', '{}'::jsonb
),
(
  '33333333-3333-4333-8333-333333333332',
  'issue_refund', 'deny', '{}'::jsonb
),
(
  '33333333-3333-4333-8333-333333333332',
  'create_ticket', 'deny', '{}'::jsonb
),
-- Analyst agent: read-only analytics.
(
  '33333333-3333-4333-8333-333333333333',
  'read_trace_summaries', 'allow', '{}'::jsonb
)
on conflict (agent_id, tool_name) do nothing;

insert into public.budgets (
  agent_id, max_cost_usd_day, max_calls_day, max_tokens_run
)
values
('33333333-3333-4333-8333-333333333331', 10, 100, 12000),
('33333333-3333-4333-8333-333333333332', 2, 50, 6000),
('33333333-3333-4333-8333-333333333333', 5, 80, 10000)
on conflict (agent_id) do nothing;

-- Synthetic customer accounts. No real customer information.
insert into public.ledger_accounts (tenant_id, customer_ref, balance)
values
('11111111-1111-4111-8111-111111111111', 'SYN-CUST-001', 1500.00),
('11111111-1111-4111-8111-111111111111', 'SYN-CUST-002', 850.50),
('11111111-1111-4111-8111-111111111111', 'SYN-CUST-003', 2400.00)
on conflict (tenant_id, customer_ref) do nothing;

insert into public.tickets (tenant_id, subject, status, body)
values
(
  '11111111-1111-4111-8111-111111111111',
  '[SYNTHETIC] Demo refund inquiry',
  'open',
  'Synthetic demo ticket. No real customer data.'
),
(
  '11111111-1111-4111-8111-111111111111',
  '[SYNTHETIC] Demo account access issue',
  'in_progress',
  'Synthetic demo ticket. No real customer data.'
);

-- Initial active policy: default-deny placeholder.
insert into public.policies (tenant_id, version, rules_json, active)
values (
  '11111111-1111-4111-8111-111111111111',
  1,
  '{"description":"Initial demo policy; gateway enforcement will be implemented in a later step.","default":"deny","rules":[]}'::jsonb,
  true
)
on conflict (tenant_id, version) do nothing;

-- End of initial migration and synthetic seed.
