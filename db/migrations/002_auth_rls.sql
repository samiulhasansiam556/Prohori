
-- Prohori | Step 2 | Authentication and tenant RLS
-- Existing 001_initial_schema.sql remains unchanged.

-- 1. Helper functions: resolve the authenticated user's tenant and role.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_tenant_id() from public;
revoke all on function public.current_app_role() from public;

grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;

-- 2. Ensure RLS is enabled.
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.agent_permissions enable row level security;
alter table public.policies enable row level security;
alter table public.prompts enable row level security;
alter table public.runs enable row level security;
alter table public.trace_steps enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_log enable row level security;
alter table public.eval_suites enable row level security;
alter table public.eval_results enable row level security;
alter table public.budgets enable row level security;
alter table public.anomalies enable row level security;
alter table public.documents enable row level security;
alter table public.kb_chunks enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_refunds enable row level security;
alter table public.tickets enable row level security;
alter table public.api_keys enable row level security;

-- 3. Tenant and profile access.
create policy "tenant_select_own"
on public.tenants for select to authenticated
using (id = public.current_tenant_id());

create policy "profile_select_own_or_admin"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or (
    tenant_id = public.current_tenant_id()
    and public.current_app_role() = 'admin'
  )
);

-- Profile creation and role changes are reserved for trusted
-- server-side provisioning. No client insert/update/delete policies.

-- 4. Agent registry.
create policy "agents_select_tenant"
on public.agents for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy "agents_insert_admin"
on public.agents for insert to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() = 'admin'
);

create policy "agents_update_admin"
on public.agents for update to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() = 'admin'
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() = 'admin'
);

create policy "agents_delete_admin"
on public.agents for delete to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() = 'admin'
);

create policy "agent_permissions_select_tenant"
on public.agent_permissions for select to authenticated
using (
  exists (
    select 1 from public.agents a
    where a.id = agent_id
      and a.tenant_id = public.current_tenant_id()
  )
);

create policy "agent_permissions_admin_manage"
on public.agent_permissions for all to authenticated
using (
  public.current_app_role() = 'admin'
  and exists (
    select 1 from public.agents a
    where a.id = agent_id
      and a.tenant_id = public.current_tenant_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  and exists (
    select 1 from public.agents a
    where a.id = agent_id
      and a.tenant_id = public.current_tenant_id()
  )
);

-- 5. Policies and shared prompts.
create policy "policies_select_tenant"
on public.policies for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy "policies_admin_manage"
on public.policies for all to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() = 'admin'
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() = 'admin'
);

create policy "prompts_select_active"
on public.prompts for select to authenticated
using (active = true);

-- 6. Runs and trace data.
create policy "runs_select_tenant"
on public.runs for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy "trace_steps_select_tenant"
on public.trace_steps for select to authenticated
using (
  exists (
    select 1 from public.runs r
    where r.id = run_id
      and r.tenant_id = public.current_tenant_id()
  )
);

create policy "eval_results_select_tenant"
on public.eval_results for select to authenticated
using (
  exists (
    select 1 from public.runs r
    where r.id = run_id
      and r.tenant_id = public.current_tenant_id()
  )
);

create policy "eval_suites_select"
on public.eval_suites for select to authenticated
using (true);

-- 7. Human approval decisions.
create policy "approvals_select_tenant"
on public.approvals for select to authenticated
using (
  exists (
    select 1 from public.runs r
    where r.id = run_id
      and r.tenant_id = public.current_tenant_id()
  )
);

create policy "approvals_operator_decide"
on public.approvals for update to authenticated
using (
  status = 'pending'
  and public.current_app_role() in ('admin', 'operator')
  and exists (
    select 1 from public.runs r
    where r.id = run_id
      and r.tenant_id = public.current_tenant_id()
  )
)
with check (
  status in ('approved', 'rejected')
  and decided_by = auth.uid()
  and decided_at is not null
);

-- 8. Audit log: read-only for authenticated users.
create policy "audit_log_select_tenant"
on public.audit_log for select to authenticated
using (tenant_id = public.current_tenant_id());

-- 9. Budgets and anomalies.
create policy "budgets_select_tenant"
on public.budgets for select to authenticated
using (
  exists (
    select 1 from public.agents a
    where a.id = agent_id
      and a.tenant_id = public.current_tenant_id()
  )
);

create policy "budgets_admin_manage"
on public.budgets for all to authenticated
using (
  public.current_app_role() = 'admin'
  and exists (
    select 1 from public.agents a
    where a.id = agent_id
      and a.tenant_id = public.current_tenant_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  and exists (
    select 1 from public.agents a
    where a.id = agent_id
      and a.tenant_id = public.current_tenant_id()
  )
);

create policy "anomalies_select_tenant"
on public.anomalies for select to authenticated
using (
  exists (
    select 1 from public.agents a
    where a.id = agent_id
      and a.tenant_id = public.current_tenant_id()
  )
);

-- 10. Knowledge base.
create policy "documents_select_tenant"
on public.documents for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy "documents_operator_insert"
on public.documents for insert to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('admin', 'operator')
);

create policy "documents_operator_update"
on public.documents for update to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('admin', 'operator')
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('admin', 'operator')
);

create policy "documents_admin_delete"
on public.documents for delete to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() = 'admin'
);

create policy "kb_chunks_select_tenant"
on public.kb_chunks for select to authenticated
using (
  exists (
    select 1 from public.documents d
    where d.id = document_id
      and d.tenant_id = public.current_tenant_id()
  )
);

create policy "kb_chunks_operator_insert"
on public.kb_chunks for insert to authenticated
with check (
  public.current_app_role() in ('admin', 'operator')
  and exists (
    select 1 from public.documents d
    where d.id = document_id
      and d.tenant_id = public.current_tenant_id()
  )
);

-- 11. Synthetic ledger: read-only through user sessions.
create policy "ledger_accounts_select_tenant"
on public.ledger_accounts for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy "ledger_refunds_select_tenant"
on public.ledger_refunds for select to authenticated
using (
  exists (
    select 1 from public.ledger_accounts a
    where a.id = account_id
      and a.tenant_id = public.current_tenant_id()
  )
);

-- 12. Tickets.
create policy "tickets_select_tenant"
on public.tickets for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy "tickets_operator_insert"
on public.tickets for insert to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('admin', 'operator')
);

create policy "tickets_operator_update"
on public.tickets for update to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('admin', 'operator')
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() in ('admin', 'operator')
);

create policy "tickets_admin_delete"
on public.tickets for delete to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() = 'admin'
);

-- 13. API keys: admin read-only; creation/revocation via trusted server.
create policy "api_keys_admin_select"
on public.api_keys for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_app_role() = 'admin'
);
