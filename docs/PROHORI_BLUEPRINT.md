# PROHORI — AgentOps Control Plane

## Project Blueprint (single source of truth)

International AI Builders Congress 2026 · Competition 1 (Team-Built Product)
Domain: **InfraSphere AI** · Challenge: **AgentOps** (build, deploy, monitor, and govern AI agents at scale; MCP + observability + evaluation; winning signal: reliable, governable agent systems)

Team: **Samiul Hasan Siam** (leader, architecture) · **Nahid Hasan Rifat** (backend, data) · **Nisat Tasnim Mahi** (AI/ML, evals, guardrails) · **Fatema Binte Ashique** (UI/UX, presentation, video)

This file replaces `PROHORI\_BUILD\_SPEC.md` and `PROHORI\_ROADMAP.md` (no layers, no dates). Put it in the repo root. Any agentic IDE (Antigravity, Cursor, Claude Code,Codex etc.) should read it first.

\---

## 0\. How to use this blueprint

### 0.1 Working rules (for humans and AI agents)

1. Read this file and `AGENTS.md` before doing anything. Implement **only the step named** in the request.
2. Build **vertical slices**: each step delivers one complete feature (database, backend, AI, UI, tests) and leaves the app running.
3. A step is done only when its **Done when** checks pass. Then: update the Status block, write step notes, log the prompts used.
4. **Honesty:** no fabricated demos or simulated results (Code of Conduct). Synthetic data is labelled synthetic in UI, docs, and form. Only measured numbers go in KPIs. Tick form boxes only for things really built and used.
5. Never put API keys in the frontend or the repo. Server-side `.env` only.
6. Every tool call by an agent goes through the gateway. There is no direct agent → tool path anywhere in the code.
7. Validate all external input with Zod. Log all decisions to the audit log.
8. Keep changes small and reviewable; commit per step.

### 0.2 `AGENTS.md` (create in repo root with this content)

```
Read PROHORI\_BLUEPRINT.md first.
Implement only the step I name. Follow the stack, data model, and API in the blueprint.
Do not add features outside the named step. Ask if something is unclear.
When done: check the step's "Done when" list, update the Status block in the blueprint,
add a short entry to docs/notes/<step>.md (what, why, one metric or screenshot),
and append every prompt used to docs/prompts.md.
Never commit secrets. Label all demo data as synthetic.
```

### 0.3 Status block (update after each step)

|#|Step|Status|
|-|-|-|
|1|Foundation and deployment|not started|
|2|Auth, roles, demo access, tenants|not started|
|3|Knowledge base and RAG|not started|
|4|MCP tool servers|not started|
|5|MCP gateway and policy engine|not started|
|6|Agent runner and agents|not started|
|7|Tracing, cost, observability|not started|
|8|Guardrails|not started|
|9|Approvals (human-in-the-loop) and audit|not started|
|10|Evaluation and red-team suites|not started|
|11|Budgets, kill-switch, anomaly detection|not started|
|12|Token and cost optimization, model routing|not started|
|13|Retrieval upgrade|not started|
|14|Automation and realtime|not started|
|15|Data pipeline: ingestion, exports, dashboards|not started|
|16|External agent onboarding and public API|not started|
|17|Sovereignty mode (local model)|not started|
|18|`/docs` module, diagrams, ethics|not started|
|19|Hardening, load test, KPI measurement|not started|
|20|Video, form, submission|not started|

\---

## 1\. Product

### 1.1 One-paragraph description

Organizations are deploying AI agents faster than they can govern them. **Prohori** (প্রহরী, "guardian") is a control plane that sits between agents and the tools they use. Every agent is registered; every tool call passes through an **MCP gateway** that enforces permissions and policies; every step is **traced** (latency, tokens, cost); outputs are **evaluated** and **PII-redacted**; risky actions need **human approval**; budgets and anomaly detection can **quarantine** a misbehaving agent; everything lands in a **tamper-evident audit log**.

### 1.2 Problem (use in the form)

* Agents call tools with no central permission model; a compromised or over-privileged agent can act freely.
* Teams cannot see what agents did, what it cost, or whether answers were grounded.
* No standard way to test agent reliability before and after changes.
* Regulated sectors (banking, health, government) cannot adopt agents without audit, approvals, and data control.

### 1.3 Target users and buyers

Platform/AI engineering teams, security and compliance officers, and operations leads in banks, fintechs, hospitals, and public agencies. Business model: per-agent seat plus per-governed-call usage; self-hosted enterprise tier for data sovereignty.

### 1.4 Demonstration domain (the story the demo tells)

A **finance-operations support agent** answers customer questions from policy documents and can issue refunds. All business data is **synthetic and labelled so**. The same governed platform could front any agent; finance ops is the demo.

### 1.5 Impact KPIs (measure; report only what you measured)

* Unauthorized tool calls blocked: % of scripted attempts (target 100%).
* PII leaked into stored traces: count on the test set (target 0).
* Prompt-injection attempts blocked: blocked/total on the red-team set.
* Groundedness and policy-compliance eval score: before and after changes.
* Gateway overhead: mean and p95 latency added per call.
* Cost reduction from caching and routing: % vs baseline.
* Approval round-trip time; anomaly detection precision on injected anomalies.

### 1.6 How it scores against the team rubric (5 × 20)

|Component|Where Prohori earns it|
|-|-|
|Innovation and AI-native design|Governing agents themselves; MCP-native; eval-in-the-loop; anomaly quarantine|
|Technical excellence and architecture|Gateway, policy engine, tracing, eval, realtime, modular services|
|Business value and viability|Clear buyer, pricing, regulated-sector demand|
|Global scalability and impact|Stateless gateway, multi-tenant, region/sovereignty mode, OTel export|
|Responsible AI, data sovereignty, presentation|PII redaction, HITL, audit, local-model mode, clear story and `/docs`|

\---

## 2\. Feature scope (everything we build)

|ID|Feature|Summary|
|-|-|-|
|F1|Agent registry|Create/list/edit agents: name, owner, model, system prompt, status, tools allowed|
|F2|MCP tool servers|`policy-kb` (RAG search), `ledger` (balance lookup, issue refund), `ticketing` (create/update ticket); all synthetic|
|F3|MCP gateway|Single choke point for all tool calls: auth, policy, redaction, tracing, approval, budget checks|
|F4|Policy engine|Rules: allow / deny / require\_approval with conditions (tool, amount, time, rate); versioned; dry-run mode|
|F5|Agent runner|Tool-use loop with step cap, structured outputs, three seeded agents|
|F6|Multi-agent flow|Supervisor routes to worker agents; guard agent reviews risky plans|
|F7|RAG knowledge base|Ingest policy docs, chunk, embed, search with citations|
|F8|Tracing|Every step recorded: type, tool, redacted args/result, decision, latency, tokens, cost|
|F9|Guardrails|PII redaction, injection detection, output schema validation, citation (grounding) check|
|F10|Human approvals|Pause/resume on `require\_approval`; approve/reject with reason|
|F11|Audit log|Append-only, hash-chained, filterable, exportable|
|F12|Evaluation|LLM-as-judge per run; regression suite; red-team suite; runs from CLI and CI|
|F13|Budgets and kill-switch|Per-agent cost/token/call caps; manual and automatic quarantine|
|F14|Anomaly detection|Statistical detection on call rate, cost, new-tool usage, denial spikes|
|F15|Token/cost optimization|Prompt caching, model routing, context trimming; before/after metrics|
|F16|Realtime UI|Live traces, approvals, and alerts without refresh|
|F17|Automation|n8n workflows: notify on pending approval/blocked call/quarantine; scheduled evals|
|F18|Data pipeline|Upload PDF/MD/CSV → parse → chunk → embed; CSV/PDF/JSON exports|
|F19|Auth, roles, tenants|Admin / operator / viewer; tenant-scoped data; one-click demo access|
|F20|External agent onboarding|Public MCP endpoint and API keys so outside agents connect through the gateway|
|F21|Sovereignty mode|Per-agent option to use a local model (Ollama); region and retention settings documented|
|F22|Dashboards|Overview (runs, cost, blocks, eval trend), agent detail, trace timeline, eval results|
|F23|`/docs` module|Public live page: pitch, architecture, data flow, security, system status|
|F24|OpenTelemetry export|Traces exported in OTel format|
|F25|Prompt registry|Versioned prompts with rollback; eval compares versions|

**Not in scope (by decision):** Bangla UI (UI strings are kept in one `en.json` so language packs can be added; a Bangla question may appear once in the demo to show language-agnostic behavior), fine-tuning (no natural fit; never claim it).

\---

## 3\. Architecture

### 3.1 System diagram

```
                         ┌─────────────────────────────┐
                         │  Web Dashboard (React)      │
                         │  runs · traces · approvals  │
                         │  agents · policies · evals  │
                         └──────────────┬──────────────┘
                              REST + Realtime (Supabase)
                                        │
┌───────────────┐   MCP/HTTP   ┌────────▼─────────┐        ┌──────────────────┐
│ External      ├─────────────▶│   API Server     │───────▶│ Postgres         │
│ agents (F20)  │              │ (Express, TS)    │        │ + pgvector       │
└───────────────┘              └───┬──────────┬───┘        │ (Supabase)       │
                                   │          │            └────────▲─────────┘
                       ┌───────────▼───┐   ┌──▼─────────────┐       │ traces, audit,
                       │ Agent Runner  │   │ Eval Service   │       │ approvals, evals
                       │ (LLM loop,    │   │ (judge, suites)│       │
                       │ multi-agent)  │   └────────────────┘       │
                       └───────┬───────┘                            │
                          MCP calls                                 │
                       ┌───────▼──────────────────────────────┐     │
                       │            MCP GATEWAY               ├─────┘
                       │ authN · policy engine · budgets      │
                       │ PII redaction · injection checks     │
                       │ approval pause/resume · tracer       │
                       │ anomaly hooks · audit (hash chain)   │
                       └───┬───────────────┬──────────────┬───┘
                           │ MCP           │ MCP          │ MCP
                    ┌──────▼─────┐  ┌──────▼─────┐  ┌─────▼──────┐
                    │ policy-kb  │  │  ledger    │  │ ticketing  │
                    │ (RAG)      │  │ (synthetic)│  │ (synthetic)│
                    └────────────┘  └────────────┘  └────────────┘

 Side systems: n8n (notifications, scheduled evals) · OTel collector (optional)
               Ollama (local model, sovereignty mode) · GitHub Actions (CI, keep-alive)
```

### 3.2 Request flow (input → AI → output)

1. User or external agent sends input to `/api/runs`.
2. Agent runner calls the LLM with the agent's system prompt and allowed tool schemas.
3. LLM requests a tool; runner sends it to the **gateway** (never directly).
4. Gateway: authenticate agent → check quarantine/budget → run input guardrails (PII redaction, injection check) → evaluate policy (`allow` / `deny` / `require\_approval`) → if approval needed, pause run and notify → call tool server over MCP → redact result → record trace step and audit entry → return result.
5. Runner continues until the model answers or the step cap is hit.
6. Output guardrails: schema validation, PII redaction, citation/grounding check.
7. Eval service scores the run; results stored; dashboard updates in realtime.

### 3.3 Components and responsibilities

|Component|Responsibility|
|-|-|
|`apps/web`|React dashboard, demo login, `/docs`|
|`apps/api`|REST API, auth, run orchestration, approvals, exports|
|`packages/gateway`|MCP gateway, policy engine, guardrails, tracer, audit|
|`packages/agents`|Agent runner, multi-agent logic, prompt registry|
|`packages/tools/\*`|MCP tool servers: `policy-kb`, `ledger`, `ticketing`|
|`packages/eval`|Judge, regression/red-team suites, report generator|
|`packages/shared`|Zod schemas, types, config|
|`infra/`|n8n workflows, OTel config, Dockerfiles, GitHub Actions|
|`docs/`|notes per step, prompts log, diagrams, exports of this blueprint|

\---

## 4\. Technology choices

|Concern|Choice|Notes|
|-|-|-|
|Language|TypeScript (strict) everywhere|Matches PERN skills|
|Frontend|React + Vite + Tailwind; Recharts; Supabase Realtime client|Optional Grafana/Metabase board for the data-lifecycle section|
|API|Node.js + Express + Zod||
|Database|Supabase Postgres + `pgvector` (new project, not the old one)|Free tier pauses after inactivity; keep-alive in Step 1; consider Pro before showcase|
|Auth|Supabase Auth with roles; demo-login endpoints||
|MCP|`@modelcontextprotocol/sdk` (TypeScript)|Gateway is an MCP server toward agents and MCP client toward tools; HTTP transport; stdio for local tools|
|Primary LLM|Claude (agent reasoning)|Verify current model IDs in provider docs; put in config, never hardcode|
|Cheap/fast LLM|Smaller model for judge, guards, routing|Second family (e.g. Gemini) for cross-checking the judge reduces self-preference bias; use only if truly used|
|Embeddings|One embedding provider (OpenAI, Gemini, or local via Ollama)|Anthropic has no embeddings model; record dimension in config|
|Local model|Ollama (e.g. a small open model)|Sovereignty mode (F21)|
|Automation|n8n (self-hosted via Docker)||
|Realtime|Supabase Realtime||
|Observability|Own trace tables plus OpenTelemetry export||
|CI|GitHub Actions: tests, regression eval, keep-alive ping||
|Hosting|Frontend: Vercel · API/gateway: Render/Railway/Fly (check sleep behavior) · DB: Supabase||
|Testing|Vitest (unit), Playwright (e2e smoke), eval CLI||

\---

## 5\. Repository structure

```
prohori/
├─ AGENTS.md
├─ PROHORI\_BLUEPRINT.md
├─ README.md
├─ apps/
│  ├─ web/            (React app, /docs)
│  └─ api/            (Express API)
├─ packages/
│  ├─ shared/         (schemas, types, config)
│  ├─ gateway/        (policy, guardrails, tracer, audit, budgets, anomaly)
│  ├─ agents/         (runner, supervisor, prompt registry)
│  ├─ tools/
│  │  ├─ policy-kb/
│  │  ├─ ledger/
│  │  └─ ticketing/
│  └─ eval/           (judge, regression/, redteam/, report)
├─ infra/             (docker-compose, n8n/, otel/, github workflows)
├─ db/                (migrations, seed)
└─ docs/              (notes/, prompts.md, diagrams/)
```

\---

## 6\. Data model (PostgreSQL)

```sql
-- tenancy and users
tenants(id uuid pk, name text, region text, created\_at timestamptz)
profiles(id uuid pk references auth.users, tenant\_id uuid, role text check (role in ('admin','operator','viewer')))

-- agents and permissions
agents(id uuid pk, tenant\_id uuid, name text, owner text, description text,
       model text, provider text,            -- 'cloud' | 'local' (sovereignty)
       system\_prompt\_id uuid, status text,   -- 'active' | 'quarantined' | 'disabled'
       created\_at timestamptz)
agent\_permissions(id uuid pk, agent\_id uuid, tool\_name text,
       effect text check (effect in ('allow','deny','require\_approval')),
       condition\_json jsonb)                 -- e.g. {"amount\_gt": 100}
policies(id uuid pk, tenant\_id uuid, version int, rules\_json jsonb, active bool, created\_by uuid, created\_at timestamptz)
prompts(id uuid pk, name text, version int, content text, active bool, created\_at timestamptz)

-- runs and traces
runs(id uuid pk, tenant\_id uuid, agent\_id uuid, user\_input text, final\_output text,
     status text,  -- 'running'|'waiting\_approval'|'completed'|'failed'|'blocked'
     total\_tokens int, total\_cost\_usd numeric, eval\_score numeric,
     started\_at timestamptz, ended\_at timestamptz)
trace\_steps(id uuid pk, run\_id uuid, step\_no int,
     type text,    -- 'llm'|'tool\_call'|'guardrail'|'approval'|'policy'
     tool\_name text, args\_redacted jsonb, result\_redacted jsonb,
     decision text, reason text, latency\_ms int,
     tokens\_in int, tokens\_out int, cost\_usd numeric, created\_at timestamptz)

-- approvals, audit, evals
approvals(id uuid pk, run\_id uuid, step\_id uuid, requested\_action jsonb,
     status text, decided\_by uuid, decided\_at timestamptz, reason text)
audit\_log(id bigserial pk, tenant\_id uuid, actor text, action text, entity text, entity\_id text,
     details\_json jsonb, prev\_hash text, hash text, created\_at timestamptz)  -- append-only, hash-chained
eval\_results(id uuid pk, run\_id uuid, suite text, metric text, score numeric, rationale text, created\_at timestamptz)
eval\_suites(id uuid pk, name text, kind text, cases\_json jsonb, created\_at timestamptz)  -- 'regression'|'redteam'

-- budgets and anomalies
budgets(agent\_id uuid pk, max\_cost\_usd\_day numeric, max\_calls\_day int, max\_tokens\_run int)
anomalies(id uuid pk, agent\_id uuid, kind text, severity text, details\_json jsonb, action\_taken text, created\_at timestamptz)

-- knowledge base and tools data (all synthetic)
documents(id uuid pk, tenant\_id uuid, title text, source text, created\_at timestamptz)
kb\_chunks(id uuid pk, document\_id uuid, content text, embedding vector, metadata jsonb)
ledger\_accounts(id uuid pk, customer\_ref text, balance numeric)          -- synthetic
ledger\_refunds(id uuid pk, account\_id uuid, amount numeric, status text, run\_id uuid, created\_at timestamptz)  -- synthetic
tickets(id uuid pk, subject text, status text, body text, created\_at timestamptz)  -- synthetic

-- external agents
api\_keys(id uuid pk, tenant\_id uuid, agent\_id uuid, key\_hash text, label text, created\_at timestamptz, revoked bool)
```

Row-level security: every table scoped by `tenant\_id`. The DB role used by the audit writer has insert/select only on `audit\_log`.

**Audit hash chain:** `hash = sha256(prev\_hash || canonical\_json(entry))`; a verify endpoint recomputes the chain and reports the first break.

\---

## 7\. Module specifications

### 7.1 MCP gateway (F3)

* Exposes an MCP server interface to agents; acts as MCP client to tool servers.
* Pipeline order (fixed): `authenticate → quarantine/budget check → input guardrails → policy decision → (approval) → tool call → output guardrails → trace + audit → return`.
* Returns structured decisions: `{decision, reason, policy\_version}`; denials are visible to the agent as tool errors with a safe message.
* Stateless; all state in Postgres, so it can scale horizontally.

### 7.2 Policy engine (F4)

* Rules JSON, evaluated top-down, first match wins, default deny.
* Condition operators on tool args and context: `eq, gt, lt, in, regex`, time window, per-minute rate.
* Example: `issue\_refund` with `amount > 100` → `require\_approval`; `amount > 1000` → `deny`; any agent with role `intern` → `deny` for all write tools.
* **Dry-run:** replays recent runs against a draft policy and reports what would change.
* Every policy change is versioned and audited.

### 7.3 Tool servers (F2, all synthetic)

* `policy-kb`: `search\_policy(query, k)` returns chunks with source and score.
* `ledger`: `get\_balance(customer\_ref)`, `issue\_refund(customer\_ref, amount, reason)`.
* `ticketing`: `create\_ticket(subject, body)`, `update\_ticket(id, status)`.
* Each is a separate MCP server process with its own schema; tool inputs validated by Zod.

### 7.4 Agent runner and agents (F5, F6)

* Loop: call LLM with tools → if tool request, route via gateway → append result → repeat; step cap (default 6); abort on budget/quarantine.
* Structured final answer: `{answer, citations\[], confidence}` validated by Zod; one repair retry on validation failure.
* Seeded agents:

  * `support-agent`: privileged; can search policy, view balance, refund within limits, create tickets.
  * `intern-agent`: restricted; read-only; any write is denied.
  * `analyst-agent`: read-only access to trace summaries via an MCP data tool; answers "which agent cost the most this week?"
* Multi-agent flow (F6): a supervisor classifies the request, delegates to a worker agent, and a guard agent reviews any plan that includes a write action before it is sent to the gateway. Keep it small and explainable.

### 7.5 RAG (F7, upgrade in Step 13)

* Baseline: chunk (500-800 tokens, overlap), embed, store in pgvector, cosine search top-k with citations.
* Upgrades, each measured against the baseline on a fixed question set: hybrid search (keyword + vector), reranker, query rewriting, contextual chunk summaries. Keep only what improves results; record the comparison table.

### 7.6 Guardrails (F9)

* **PII redaction:** emails, phone numbers, card-like numbers, national-ID-like patterns, names where detectable; applied to inputs, tool args/results, outputs, and everything stored in traces. Unit-tested with at least 20 cases.
* **Injection detection:** heuristics (instruction-override patterns, tool-name spoofing) plus a small classifier prompt on a cheap model for tool results and retrieved text; flagged content is quarantined from the model context and logged.
* **Output validation:** Zod schema; reject or repair.
* **Grounding check:** answer claims must be supported by cited chunks; unsupported answers get lower eval score and a warning.

### 7.7 Tracing and observability (F8, F24)

* One `trace\_steps` row per step with redacted payloads, latency, tokens, cost (computed from a model price table in config).
* Dashboard timeline per run; aggregate charts by agent, tool, day.
* OTel export: spans for run → llm → tool call, so traces can be viewed in any OTel backend.

### 7.8 Approvals (F10)

* On `require\_approval`: run status `waiting\_approval`, approval row created, realtime event and n8n webhook fired.
* Approver (operator/admin) approves or rejects with a reason; run resumes or aborts; both outcomes audited.
* Approvals expire after a configurable time (default reject).

### 7.9 Audit (F11)

* Entries for: policy decisions, approvals, config changes, agent status changes, exports, logins.
* Hash chain with verify endpoint; filters by actor, agent, action, date; export CSV/JSON/PDF.

### 7.10 Evaluation (F12, F25)

* **Judge:** per-run LLM-as-judge returns structured `{groundedness, policy\_compliance, helpfulness, rationale}` (0-1). Judge uses a different model/family than the agent where possible.
* **Regression suite:** at least 50 cases (policy questions with expected facts, refusal cases, tool-choice cases, edge cases). CLI `npm run eval:regression` prints a report and stores results.
* **Red-team suite:** at least 30 cases (prompt injection via user and via tool results, over-privilege attempts, data-exfiltration attempts, PII fishing). Report blocked/total.
* CI runs both suites on every change to prompts, policies, or gateway code; fail the build below thresholds.
* Prompt registry (F25): evaluate prompt version A vs B; promote or roll back.

### 7.11 Budgets, kill-switch, anomaly detection (F13, F14)

* Budgets per agent: daily cost, daily calls, per-run tokens. Exceeding → block and alert; admin can raise or reset.
* Kill-switch: manual quarantine button; quarantined agents' calls are denied at the gateway.
* Anomaly detection (statistical, explainable): z-score or EWMA on calls/minute, cost/run, denial rate; first-time tool usage; sudden argument-size spikes. Output: anomaly row, severity, optional auto-quarantine for high severity. Validate with injected anomalies and report precision/recall honestly.

### 7.12 Token and cost optimization (F15)

* Prompt caching for static system prompts and tool schemas.
* Model routing: cheap model for classification, guard checks, and judge; strong model for reasoning.
* Context trimming and rolling summary for long conversations; structured outputs everywhere.
* Report cost per run before and after, with the method. (Tools named in the form such as Graphify, Caveman, Codeburn, and LLMLingua: research first, try them, and claim only what you actually used and measured.)

### 7.13 Automation and realtime (F16, F17)

* Supabase Realtime pushes new trace steps, approvals, anomalies to the dashboard.
* n8n workflows: (1) pending approval → message to approvers; (2) blocked call or quarantine → alert; (3) nightly regression eval → report; (4) weekly cost summary.
* GitHub Actions: tests, eval gates, and the keep-alive ping that prevents the free database from pausing.

### 7.14 Data pipeline (F18)

* Upload UI accepts PDF, Markdown, CSV; parsing (e.g. pdf text extraction), cleaning, chunking, embedding, indexing; progress and errors visible; duplicate detection by content hash.
* Exports: audit and traces as CSV/JSON/PDF; eval reports as Markdown/PDF.
* Dashboards: in-app Recharts; optional Grafana or Metabase board connected to Postgres.

### 7.15 External agent onboarding (F20)

* Admin creates an API key bound to an agent identity; the key is shown once and stored hashed.
* External agent connects to the gateway MCP endpoint with the key; all of the above applies.
* Provide a short SDK/usage snippet in `/docs` and a sample external agent script as proof.

### 7.16 Sovereignty mode (F21)

* Agent `provider = local` routes LLM calls to Ollama; embeddings can also be local.
* Documented guarantees: in local mode, prompts and data do not leave the host. State clearly what still goes to cloud (if anything) and how to deploy in a chosen region.
* Retention settings: trace and audit retention days per tenant (configurable); documented in `/docs`.

### 7.17 Web app screens (F19, F22, F23)

|Route|Purpose|Roles|
|-|-|-|
|`/`|Landing with one-click "Enter as Demo Admin" and "Enter as Demo User"|public|
|`/app`|Overview: runs, cost, blocks, eval trend, anomalies|all|
|`/app/console`|Run an agent, watch steps stream in realtime|operator, admin|
|`/app/runs/:id`|Trace timeline, decisions, cost, eval|all|
|`/app/agents`|Registry, permissions, status, budgets, quarantine|admin|
|`/app/policies`|Edit, version, dry-run policies|admin|
|`/app/approvals`|Pending and decided approvals|operator, admin|
|`/app/audit`|Filter, verify chain, export|admin, viewer|
|`/app/evals`|Suites, results, trends, prompt versions|operator, admin|
|`/app/knowledge`|Upload and manage documents|admin|
|`/app/settings`|API keys, sovereignty mode, retention|admin|
|`/docs`|Public pitch, architecture, data flow, security, live status|public|
|UI strings in a single `en.json`. Design tokens, light/dark, accessible contrast, clear empty states and sample data for first-time visitors.|||

\---

## 8\. API (REST, JSON, Zod-validated)

|Method|Path|Purpose|
|-|-|-|
|POST|`/api/demo-login`|`{role}` returns demo session|
|GET/POST|`/api/agents`, `/api/agents/:id`|Registry CRUD|
|POST|`/api/agents/:id/quarantine`|Kill-switch|
|GET/PUT|`/api/agents/:id/permissions`|Permissions|
|GET/POST|`/api/policies`, POST `/api/policies/dry-run`|Versioned policies|
|POST|`/api/runs`|Start run `{agent\_id, input}`|
|GET|`/api/runs`, `/api/runs/:id`|List and detail with trace|
|GET|`/api/approvals`, POST `/api/approvals/:id/decision`|Approvals|
|GET|`/api/audit`, GET `/api/audit/verify`, GET `/api/audit/export`|Audit|
|GET/POST|`/api/evals/suites`, POST `/api/evals/run`, GET `/api/evals/results`|Evaluation|
|GET|`/api/stats`, `/api/anomalies`|Dashboards|
|POST|`/api/documents` (upload), GET `/api/documents`|Knowledge base|
|GET/POST|`/api/keys`|External agent keys|
|POST|`/mcp`|Gateway MCP endpoint (API-key or session auth)|
|GET|`/api/health`, `/api/status`|Used by keep-alive and `/docs` status|
|Publish OpenAPI documentation for the REST API.|||

\---

## 9\. Build sequence (do in order; no dates)

Each step: **Build → Done when → Form sections filled**. After each step: update Status, write notes, log prompts.

### Step 1 — Foundation and deployment

**Build:** monorepo, TypeScript config, lint/test setup; new Supabase project; migrations for all tables in §6; seed (tenant, 3 agents, permissions, a few synthetic accounts); deploy empty web and API to public URLs; GitHub Actions keep-alive; `AGENTS.md`, `docs/prompts.md`, `docs/notes/`.
**Done when:** public URL opens; migrations and seed run clean; keep-alive workflow succeeds; repo has README with run instructions.
**Form:** Tooling and IDE, deployment method, frameworks, context/memory files, AI-DLC (spec-driven with this blueprint and AGENTS.md), open-source stack, workflow automation (GitHub Actions).

### Step 2 — Auth, roles, demo access, tenants

**Build:** Supabase Auth, roles (admin/operator/viewer), RLS by tenant, demo-login for admin and user, protected routes, landing page.
**Done when:** two clicks from landing to the app as demo admin or demo user; viewer cannot call admin endpoints (tested).
**Form:** security section, governance (RBAC).

### Step 3 — Knowledge base and RAG baseline

**Build:** 20+ synthetic policy documents (refunds, limits, escalation, privacy, fraud rules); ingestion script, chunking, embeddings, pgvector index; search function with citations.
**Done when:** a set of 20 test questions returns relevant cited chunks; baseline retrieval score recorded.
**Form:** naive RAG, vector database, RAG architecture details, data sources (synthetic), storage (Postgres + vector).

### Step 4 — MCP tool servers

**Build:** `policy-kb`, `ledger`, `ticketing` as MCP servers with Zod-validated tools; synthetic data clearly labelled.
**Done when:** each tool callable via an MCP client in a test script; schemas documented.
**Form:** MCP usage (servers built, tools exposed, transports), acquisition (MCP servers for data access).

### Step 5 — MCP gateway and policy engine

**Build:** gateway pipeline from §7.1; policy engine with default-deny, conditions, versioning, dry-run; decision reasons.
**Done when:** support-agent can search policy; refund over the threshold requires approval; intern-agent refund is denied; dry-run shows differences between two policy versions; all covered by tests.
**Form:** MCP usage (permissions), guardrails, governance.

### Step 6 — Agent runner and agents

**Build:** tool-use loop, step cap, structured outputs with repair retry, three agents, prompt registry v1; run endpoint; console UI with streaming steps; supervisor/worker/guard flow.
**Done when:** "What is the refund window?" returns a grounded answer with citations on the live URL; multi-agent flow handles a refund request end to end.
**Form:** prompt usage, LLMs used and why, agent frameworks (custom loop; state honestly), structured outputs, multi-agent description.

### Step 7 — Tracing, cost, observability

**Build:** trace recording for every step, price table, run totals, timeline UI, overview charts, OTel export.
**Done when:** each run shows steps with latency, tokens, cost; OTel spans visible in a collector or console exporter.
**Form:** observability, cost and performance, visualization (Recharts), insights (KPIs), pipelines.

### Step 8 — Guardrails

**Build:** PII redaction module (20+ tests), injection detection (heuristic + classifier), output validation, grounding check.
**Done when:** seeded PII never appears in stored traces; injection examples in user input and in tool results are flagged and contained; tests pass.
**Form:** guardrails, safety and privacy; privacy and compliance; responsible AI.

### Step 9 — Approvals and audit

**Build:** pause/resume flow, approvals UI, expiry, audit log with hash chain, verify endpoint, filters, exports.
**Done when:** large refund waits for approval and completes after approval; reject aborts; tampering with an audit row is detected by verify.
**Form:** human-in-the-loop, governance, audit, data lineage notes.

### Step 10 — Evaluation and red-team suites

**Build:** judge, 50+ regression cases, 30+ red-team cases, CLI runner, reports, CI gate, eval dashboard.
**Done when:** one command runs both suites and stores results; CI fails when thresholds are not met; baseline numbers recorded.
**Form:** evaluation and quality measurement, quality checks, KPIs.

### Step 11 — Budgets, kill-switch, anomaly detection

**Build:** budgets, quarantine endpoints and UI, statistical detectors, anomaly table and alerts, auto-quarantine for high severity.
**Done when:** exceeding a budget blocks calls; injected anomalies are detected and logged; precision/recall on the injected set reported honestly.
**Form:** insights (anomaly detection, statistics, rule engine), governance, cost controls.

### Step 12 — Token and cost optimization, model routing

**Build:** prompt caching, cheap-model routing for guards and judge, context trimming, rolling summary; before/after benchmark script.
**Done when:** a table shows cost and latency per run before and after, with the method.
**Form:** token optimization and tools, LLMs used (second model if truly used), how and why.

### Step 13 — Retrieval upgrade

**Build:** hybrid search, reranker, query rewriting, optional contextual chunks; evaluation against the Step 3 baseline.
**Done when:** a comparison table shows which techniques helped; only helpful ones stay enabled.
**Form:** hybrid search, rerankers, query rewriting, agentic RAG (if the supervisor retrieves iteratively), RAG details.

### Step 14 — Automation and realtime

**Build:** Supabase Realtime for traces, approvals, anomalies; n8n workflows from §7.13 with webhook endpoints.
**Done when:** a blocked call triggers an n8n alert; dashboard updates without refresh; nightly eval workflow produces a report.
**Form:** workflow automation (n8n bonus), pipelines and orchestration, streaming/real-time, scheduling.

### Step 15 — Data pipeline: ingestion, exports, dashboards

**Build:** upload UI and parsing pipeline (PDF/MD/CSV), duplicate detection, progress and error handling, exports (CSV/JSON/PDF), optional Grafana or Metabase board.
**Done when:** a new PDF uploaded in the UI becomes searchable with citations; audit and trace exports download correctly.
**Form:** acquisition (bulk upload, AI extraction), parsing and formats, outbound exports, dashboards and reports, schema validation, data cleaning.

### Step 16 — External agent onboarding and public API

**Build:** API keys, MCP endpoint auth, sample external agent script, OpenAPI docs, rate limits.
**Done when:** an agent outside the app connects with a key, is governed by the same policies, and appears in traces.
**Form:** MCP usage (reuse across agents), outbound APIs, embeddings/model serving (exposed MCP server), open source.

### Step 17 — Sovereignty mode (local model)

**Build:** Ollama integration for one agent and optional local embeddings; provider switch per agent; documentation of exactly what stays local; retention settings.
**Done when:** a run completes with a local model with no cloud LLM calls (verified in logs); quality difference noted honestly.
**Form:** local/on-device LLMs (runtime, model, hardware, quantization, why), data governance, privacy and compliance.

### Step 18 — `/docs` module, diagrams, ethics

**Build:** public `/docs` page (use the form's "copy prompt", then adapt): pitch, architecture diagram matching the code, data flow, security model, responsible-AI note, live system status from `/api/status`, API/SDK snippets; final diagrams exported to `docs/diagrams`.
**Done when:** `/docs` opens without login; every claim on it is true; diagram matches the code.
**Form:** `/docs` module, anything else about AI usage, data governance.

### Step 19 — Hardening, load test, KPI measurement

**Build:** security pass (secrets, rate limits, input limits, dependency audit, injection tests against gateway), load test (e.g. k6) with throughput and p95, final KPI measurement from real runs, tunneling exercise if used (Cloudflare Tunnel or ngrok for a local MCP demo; record what was exposed and for how long).
**Done when:** KPI table filled with measured numbers; load test results saved; no secrets in repo.
**Form:** quality/governance/observability, cost and performance, publish-local-to-internet (only if done), scalability roadmap.

### Step 20 — Video, form, submission

1. Freeze features; bug fixes only.
2. Final KPI table and eval report.
3. Record the 3-minute video (≤181 s, YouTube public/unlisted) from the final live app (script in §10).
4. Fill every required field and every optional section that is real, using the step notes.
5. Open every link in a private window; confirm demo access works without login walls.
6. Submit before the portal deadline with buffer; save the confirmation. If the portal allows editing, improve later; if not, submit only when ready.

\---

## 10\. Submission assets

### 10.1 Required form fields and where the content comes from

|Field|Source|
|-|-|
|Project Name|Prohori — AgentOps Control Plane|
|Elevator Pitch / Public Summary|§1.1|
|Domain / Challenge|InfraSphere AI / AgentOps|
|Problem Statement|§1.2 with concrete failure examples|
|Solution Description|§3 flow plus features F1-F25 that are built|
|Data and AI Provenance|Synthetic data (labelled), models used and why, embeddings, PII redaction, HITL, audit, sovereignty mode, no real personal data|
|Tooling and IDE|IDE/agent used, frameworks (§4), deployment hosts, context files (this blueprint, AGENTS.md), MCP servers, tools exposed, permissions|
|YouTube video|§10.2|
|Demo / Live links|Live URL with one-click demo access, `/docs`|
|Optional|GitHub repo, Figma/design link, Facebook video, other links, prompt library from `docs/prompts.md`|

### 10.2 Video script (≤181 s)

|Time|Segment|Show|
|-|-|-|
|0:00-0:30|Problem|Agents without permissions, audit, or quality measurement; real failure examples; team roles in one sentence|
|0:30-1:00|Solution|Prohori in one line; architecture diagram|
|1:00-2:00|Demo|Grounded answer with citation → small refund → large refund pauses and is approved → intern-agent blocked → injection attempt contained → audit chain verified → eval score and cost on the run|
|2:00-2:30|AI approach|MCP gateway and policy engine, RAG, judge and suites, routing and caching numbers, local-model mode|
|2:30-3:00|Impact and next step|Measured KPIs, who buys it, roadmap; one sentence that language packs (including Bangla) are on the roadmap|

### 10.3 Team documentation (required)

Declare roles (§ header). Every contributor, including any NRB advisor, is listed. Keep `docs/notes/` as the evidence trail.

### 10.4 Form coverage cross-check (what each form section maps to)

* **AI Detail Usage:** prompts (7.4, Step 6), token optimization (Step 12), LLMs (§4), RAG (Steps 3, 13), MCP (Steps 4, 5, 16), open source (all), agent frameworks (Step 6), evaluation (Step 10), guardrails (Step 8), frontend AI builders (whatever the team really used), workflow automation (Step 14), local LLMs (Step 17), agentic frameworks (Step 6, optionally a framework trial), AI-DLC (Step 1), `/docs` (Step 18). **Fine-tuning:** skip.
* **Data Lifecycle:** sources (Step 3), acquisition (Steps 4, 15), parsing (Step 15), storage (Steps 1, 3, 15), visualization (Steps 7, 15), insights (Steps 7, 11), pipelines (Step 14), outbound (Step 16), open source (all), governance and observability (Steps 7, 8, 9, 19), tunneling (Step 19, only if used).

\---

## 11\. Responsible AI, security, and ethics (summary for `/docs`)

* Synthetic data only; no real personal data; labelled everywhere.
* PII redaction before storage; least-privilege agents; default-deny policies.
* Human approval for risky actions; expiring approvals.
* Tamper-evident audit; exports for compliance review.
* Judge bias mitigation (different model family, rubric, spot human checks); documented limits of automated evals.
* Prompt-injection defenses at the gateway for user input and tool results; red-team suite results published.
* Data sovereignty: local-model mode, region and retention settings documented.
* Extra caution rule for InfraSphere: privacy, accuracy, and public-safety implications are stated in `/docs`.
* Known limitations are listed honestly (e.g. heuristic detection can miss novel attacks).

\---

## 12\. Risks and mitigations

|Risk|Mitigation|
|-|-|
|Scope too large|Strict step order; vertical slices; the app always runs; cut order if needed: Step 17 (local model), then 15 extras, 13, 12, then 16|
|Free-tier pause or sleeping host|Keep-alive workflow; check host sleep behavior; open app before recording and before deadlines; consider paid DB near showcase|
|Looks like "just a chatbot"|Lead with blocked calls, approvals, traces, audit, and eval evidence|
|Inflated claims|Only measured KPIs; labelled synthetic data; tick form boxes only for real work|
|LLM cost or outage|Caching, budgets, cheap-model routing, recorded fallback runs|
|IDE agent drifts from the plan|`AGENTS.md`, step-by-step prompts, review each step against "Done when"|

## 13\. Prompts to give your IDE

* **Start:** "Read PROHORI\_BLUEPRINT.md and AGENTS.md. Implement Step 1 only. Follow §4, §5, and §6. Do not add features outside Step 1."
* **Each step:** "Implement Step N from the blueprint. Show files changed, add tests for each Done-when item, then update the Status block and docs/notes."
* **Review:** "Compare the repo to Step N's Done-when list and list anything unmet or untested."
* **Docs:** "Update /docs and the architecture diagram to match the current code exactly."
* Log every prompt actually used in `docs/prompts.md` (the form has a Prompt Library).  

