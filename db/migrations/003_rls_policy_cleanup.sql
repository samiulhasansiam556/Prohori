
-- Prohori: RLS policy cleanup
-- Remove duplicate policies and restrict sensitive tables.

-- 1. Agents: keep agents_admin_manage and agents_select_tenant
drop policy if exists agents_delete_admin on public.agents;
drop policy if exists agents_insert_admin on public.agents;
drop policy if exists agents_update_admin on public.agents;

-- 2. Profiles: keep profiles_select_scope
drop policy if exists profile_select_own_or_admin on public.profiles;

-- 3. Tenants: keep tenants_select_own
drop policy if exists tenant_select_own on public.tenants;

-- 4. Documents: keep staff policies
drop policy if exists documents_operator_insert on public.documents;
drop policy if exists documents_operator_update on public.documents;

-- 5. Tickets: keep staff policies
drop policy if exists tickets_operator_insert on public.tickets;
drop policy if exists tickets_operator_update on public.tickets;

-- 6. Evaluation suites:
-- Remove both existing policies and recreate authenticated-only access.
drop policy if exists eval_suites_select on public.eval_suites;
drop policy if exists eval_suites_select_authenticated on public.eval_suites;

create policy eval_suites_select_authenticated
on public.eval_suites
for select
to authenticated
using (true);

-- 7. Prompts: no direct browser access.
-- Backend service-role access is unaffected.
drop policy if exists prompts_select_active on public.prompts;

-- 8. API keys: no direct browser access.
-- API key verification must happen server-side.
drop policy if exists api_keys_admin_select on public.api_keys;
