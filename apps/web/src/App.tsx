import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase.js";

type Role = "admin" | "operator" | "viewer";
type Page =
  | "overview"
  | "console"
  | "runs"
  | "approvals"
  | "policies"
  | "knowledge"
  | "audit";

interface Profile {
  id: string;
  tenantId: string;
  role: Role;
}

interface Agent {
  id: string;
  name: string;
  description?: string | null;
  model?: string | null;
  provider?: string | null;
  status: string;
}

interface Run {
  id: string;
  agent_id: string;
  user_input: string;
  final_output: string | null;
  status: string;
  total_tokens: number | null;
  total_cost_usd: number | null;
  started_at: string;
  ended_at: string | null;
}

interface Trace {
  id: string;
  step_no: number;
  type: string;
  tool_name?: string | null;
  args_redacted?: unknown;
  result_redacted?: unknown;
  decision?: string | null;
  reason?: string | null;
  latency_ms?: number | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  cost_usd?: number | null;
  created_at?: string;
}

interface Citation {
  title: string;
  source?: string;
  documentId?: string;
  chunkId?: string;
  score?: number;
}

interface RunOutput {
  answer?: string;
  citations?: Citation[];
  confidence?: number;
  [key: string]: unknown;
}

interface RunDetail {
  run: Run;
  traces: Trace[];
}

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const navigation: { id: Page; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "console", label: "Agent Console", icon: "⌘" },
  { id: "runs", label: "Runs", icon: "↗" },
  { id: "approvals", label: "Approvals", icon: "✓" },
  { id: "policies", label: "Policies", icon: "◇" },
  { id: "knowledge", label: "Knowledge", icon: "▤" },
  { id: "audit", label: "Audit", icon: "◷" },
];

function readOutput(value: string | null): RunOutput | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? parsed
      : { answer: String(parsed) };
  } catch {
    return { answer: value };
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(start?: string, end?: string | null) {
  if (!start || !end) return "In progress";

  const duration = Math.max(
    0,
    new Date(end).getTime() - new Date(start).getTime(),
  );

  if (duration < 1000) return `${duration} ms`;
  return `${(duration / 1000).toFixed(1)} s`;
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();

  if (["completed", "approved", "allow", "active"].includes(normalized)) {
    return "status status-success";
  }

  if (
    ["waiting_approval", "pending", "require_approval", "running"].includes(
      normalized,
    )
  ) {
    return "status status-warning";
  }

  if (
    ["failed", "blocked", "denied", "rejected", "quarantined"].includes(
      normalized,
    )
  ) {
    return "status status-danger";
  }

  return "status";
}

function Status({ value }: { value: string }) {
  return <span className={statusClass(value)}>{value.replaceAll("_", " ")}</span>;
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◇</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function App() {
  // Existing authentication state
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Dashboard state
  const [page, setPage] = useState<Page>("overview");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  // Agent console state
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [startingRun, setStartingRun] = useState(false);
  const [consoleMessage, setConsoleMessage] = useState("");

  const apiRequest = useCallback(
    async (path: string, accessToken: string, init: RequestInit = {}) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(init.headers || {}),
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message || `Request failed with status ${response.status}`,
        );
      }

      return result;
    },
    [],
  );

  const loadProfile = useCallback(
    async (accessToken: string) => {
      const result = await apiRequest("/api/auth/me", accessToken);
      setProfile(result.user);
    },
    [apiRequest],
  );

  const loadAgents = useCallback(async () => {
    const { data, error } = await supabase
      .from("agents")
      .select("id, name, description, model, provider, status")
      .order("name", { ascending: true });

    if (error) throw error;

    const list = (data || []) as Agent[];
    setAgents(list);

    setSelectedAgentId((current) => {
      if (current && list.some((agent) => agent.id === current)) {
        return current;
      }

      return list.find((agent) => agent.status === "active")?.id || "";
    });
  }, []);

  const loadRuns = useCallback(
    async (accessToken: string) => {
      const result = await apiRequest("/api/runs", accessToken);
      setRuns((result.runs || []) as Run[]);
    },
    [apiRequest],
  );  


  const loadRunDetail = useCallback(
    async (runId: string, accessToken: string) => {
      const result = await apiRequest(`/api/runs/${runId}`, accessToken);
      setRunDetail({
        run: result.run as Run,
        traces: (result.traces || []) as Trace[],
      });
    },
    [apiRequest],
  );



  

  // Restore existing Supabase session
  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const { data } = await supabase.auth.getSession();

        if (!active) return;

        setSession(data.session);

        if (data.session) {
          await loadProfile(data.session.access_token);
        }
      } catch (error) {
        if (active) {
          setAuthError(
            error instanceof Error ? error.message : "Session initialization failed",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (!newSession) {
        setProfile(null);
        setAgents([]);
        setRuns([]);
        setRunDetail(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Load real workspace data after authentication
  const refreshWorkspace = useCallback(async () => {
    if (!session) return;

    setDataLoading(true);
    setDataError("");

    try {
      await Promise.all([
        loadAgents(),
        loadRuns(session.access_token),
      ]);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Could not load workspace data",
      );
    } finally {
      setDataLoading(false);
    }
  }, [session, loadAgents, loadRuns]);

  useEffect(() => {
    if (session) void refreshWorkspace();
  }, [session, refreshWorkspace]);

  // Browser history support for dashboard routes
  useEffect(() => {
    function syncPath() {
      const path = window.location.pathname;
      const match = path.match(/^\/app\/runs\/([^/]+)$/);

      if (match) {
        setPage("runs");
        setSelectedRunId(match[1]);
        return;
      }

      const route = navigation.find(
        (item) => item.id !== "overview" && path === `/app/${item.id}`,
      );

      if (route) {
        setPage(route.id);
        setSelectedRunId(null);
      } else {
        setPage("overview");
        setSelectedRunId(null);
      }
    }

    window.addEventListener("popstate", syncPath);
    syncPath();

    return () => window.removeEventListener("popstate", syncPath);
  }, []);

useEffect(() => {
  if (!session || !selectedRunId) {
    setRunDetail(null);
    return;
  }

  const runId = selectedRunId;
  const accessToken = session.access_token;
  let active = true;

  async function load() {
    setDataLoading(true);
    setDataError("");

    try {
      await loadRunDetail(runId, accessToken);
    } catch (error) {
      if (active) {
        setRunDetail(null);
        setDataError(
          error instanceof Error ? error.message : "Could not load run details",
        );
      }
    } finally {
      if (active) setDataLoading(false);
    }
  }

  void load();

  return () => {
    active = false;
  };
}, [session, selectedRunId, loadRunDetail]);


  function navigate(nextPage: Page, runId?: string) {
    setPage(nextPage);
    setSelectedRunId(runId || null);
    setDataError("");

    const path = runId
      ? `/app/runs/${runId}`
      : nextPage === "overview"
        ? "/app"
        : `/app/${nextPage}`;

    window.history.pushState({}, "", path);
  }

  // Existing demo login flow
  async function handleDemoLogin(role: "admin" | "viewer") {
    setAuthError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/demo/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Demo login failed");
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

      if (error || !data.session) {
        throw new Error(error?.message || "Could not create demo session");
      }

      setSession(data.session);
      await loadProfile(data.session.access_token);
      navigate("overview");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Demo login failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session) {
        throw new Error(error?.message || "Login failed");
      }

      setSession(data.session);
      await loadProfile(data.session.access_token);
      navigate("overview");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setAuthError("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
      return;
    }

    setSession(null);
    setProfile(null);
    setPassword("");
    setAgents([]);
    setRuns([]);
    setRunDetail(null);
    window.history.pushState({}, "", "/");
  }

  async function handleStartRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !selectedAgentId || prompt.trim().length < 3) return;

    setStartingRun(true);
    setConsoleMessage("");
    setDataError("");

    try {
      const result = await apiRequest("/api/runs", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          agent_id: selectedAgentId,
          input: prompt.trim(),
        }),
      });

      setConsoleMessage(
        result.status === "waiting_approval"
          ? "Run paused: this action requires human approval."
          : "Run completed. Opening trace details...",
      );

      setPrompt("");
      await loadRuns(session.access_token);

      if (result.runId) {
        navigate("runs", result.runId);
      }
    } catch (error) {
      setConsoleMessage(
        error instanceof Error ? error.message : "Could not start the run",
      );
    } finally {
      setStartingRun(false);
    }
  }

  const agentName = useCallback(
    (agentId: string) =>
      agents.find((agent) => agent.id === agentId)?.name || "Unknown agent",
    [agents],
  );

  const metrics = useMemo(() => {
    const completed = runs.filter((run) => run.status === "completed").length;
    const waiting = runs.filter(
      (run) => run.status === "waiting_approval",
    ).length;
    const blocked = runs.filter((run) =>
      ["blocked", "failed"].includes(run.status),
    ).length;

    const costValues = runs
      .map((run) => run.total_cost_usd)
      .filter((value): value is number => typeof value === "number");

    const totalCost = costValues.reduce((sum, value) => sum + value, 0);

    return {
      loaded: runs.length,
      completed,
      waiting,
      blocked,
      totalCost,
      hasCostData: costValues.length > 0,
    };
  }, [runs]);

  if (loading) {
    return (
      <main className="auth-loading">
        <div className="brand-mark">P</div>
        <p>Loading Prohori workspace...</p>
      </main>
    );
  }

  // Login screen — original login methods retained
  if (!session) {
    return (
      <main className="login-page">
        <div className="login-brand">
          <div className="brand-mark">P</div>
          <div>
            <strong>prohori<span>.</span></strong>
            <small>AGENTOPS CONTROL PLANE</small>
          </div>
        </div>

        <section className="login-card">
          <div className="eyebrow">SECURE WORKSPACE</div>
          <h1>Welcome back</h1>
          <p className="muted">
            Sign in to monitor, operate and govern your AI agents.
          </p>

          <div className="demo-buttons">
            <button
              className="button button-primary"
              onClick={() => handleDemoLogin("admin")}
              disabled={loading}
            >
              Demo Admin
            </button>
            <button
              className="button button-secondary"
              onClick={() => handleDemoLogin("viewer")}
              disabled={loading}
            >
              Demo Viewer
            </button>
          </div>

          <div className="form-divider"><span>OR SIGN IN WITH EMAIL</span></div>

          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />

            {authError && <p className="error-message">{authError}</p>}

            <button
              className="button button-primary login-submit"
              type="submit"
              disabled={loading}
            >
              Sign in to workspace <span>→</span>
            </button>
          </form>
        </section>

        <p className="login-footer">
          PROHORI · GOVERNED AI OPERATIONS
        </p>
      </main>
    );
  }

  const currentNav = navigation.find((item) => item.id === page);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

  let content: ReactNode;

  if (page === "overview") {
    content = (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">WORKSPACE / OVERVIEW</div>
            <h1>Overview</h1>
            <p className="muted">
              A live view of your governed agent operations.
            </p>
          </div>
          <button
            className="button button-secondary"
            onClick={() => void refreshWorkspace()}
            disabled={dataLoading}
          >
            ↻ Refresh
          </button>
        </div>

        {dataError && <div className="notice notice-error">{dataError}</div>}

        <div className="metric-grid">
          <MetricCard
            label="Runs loaded"
            value={dataLoading ? "…" : String(metrics.loaded)}
            hint="Latest records returned by API (up to 50)"
            icon="↗"
          />
          <MetricCard
            label="Completed"
            value={dataLoading ? "…" : String(metrics.completed)}
            hint="Completed runs in loaded records"
            icon="✓"
          />
          <MetricCard
            label="Awaiting approval"
            value={dataLoading ? "…" : String(metrics.waiting)}
            hint="Runs currently waiting for approval"
            icon="◷"
          />
          <MetricCard
            label="Blocked / failed"
            value={dataLoading ? "…" : String(metrics.blocked)}
            hint="Blocked or failed runs in loaded records"
            icon="⊘"
          />
        </div>

        <div className="section-heading">
          <div>
            <h2>Recent runs</h2>
            <p className="muted">Latest execution activity from your workspace.</p>
          </div>
          <button className="text-button" onClick={() => navigate("runs")}>
            View all runs →
          </button>
        </div>

        <RunTable
          runs={runs.slice(0, 6)}
          agentName={agentName}
          onOpen={(id) => navigate("runs", id)}
          loading={dataLoading}
        />

        <div className="bottom-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Agent registry</h2>
                <p className="muted">Agents available to this tenant.</p>
              </div>
              <span className="panel-count">{agents.length}</span>
            </div>

            {agents.length === 0 ? (
              <EmptyState
                title="No agents found"
                description="The authenticated workspace returned no agent records."
              />
            ) : (
              <div className="agent-list">
                {agents.slice(0, 5).map((agent) => (
                  <div className="agent-row" key={agent.id}>
                    <div className="agent-avatar">AI</div>
                    <div className="agent-info">
                      <strong>{agent.name}</strong>
                      <small>{agent.model || "Model not configured"}</small>
                    </div>
                    <Status value={agent.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Usage snapshot</h2>
                <p className="muted">Based only on loaded run records.</p>
              </div>
            </div>
            <div className="usage-value">
              {metrics.hasCostData
                ? `$${metrics.totalCost.toFixed(4)}`
                : "Not reported"}
            </div>
            <p className="muted">
              {metrics.hasCostData
                ? "Recorded total cost for the latest loaded runs."
                : "The API has not reported cost values for these runs."}
            </p>
            <div className="usage-divider" />
            <div className="usage-meta">
              <span>Workspace role</span>
              <strong>{profile?.role || "Unknown"}</strong>
            </div>
            <div className="usage-meta">
              <span>Available agents</span>
              <strong>{agents.length}</strong>
            </div>
          </section>
        </div>
      </>
    );
  } else if (page === "console") {
    content = (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">WORKSPACE / EXECUTION</div>
            <h1>Agent Console</h1>
            <p className="muted">
              Send a task to an agent. Every tool call is routed through the Prohori gateway.
            </p>
          </div>
        </div>

        <div className="console-layout">
          <section className="panel console-panel">
            <div className="panel-heading">
              <div>
                <h2>New agent run</h2>
                <p className="muted">Choose an active agent and provide an instruction.</p>
              </div>
              <span className="live-indicator">● READY</span>
            </div>

            <form onSubmit={handleStartRun} className="console-form">
              <label htmlFor="agent">Agent</label>
              <select
                id="agent"
                value={selectedAgentId}
                onChange={(event) => setSelectedAgentId(event.target.value)}
                required
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option
                    key={agent.id}
                    value={agent.id}
                    disabled={agent.status !== "active"}
                  >
                    {agent.name} · {agent.status}
                  </option>
                ))}
              </select>

              {selectedAgent && (
                <div className="selected-agent">
                  <div className="agent-avatar">AI</div>
                  <div>
                    <strong>{selectedAgent.name}</strong>
                    <small>
                      {selectedAgent.provider || "Provider unknown"} ·{" "}
                      {selectedAgent.model || "Model unknown"}
                    </small>
                  </div>
                  <Status value={selectedAgent.status} />
                </div>
              )}

              <label htmlFor="prompt">Task instruction</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: What is the refund window? Explain the policy and cite the source."
                rows={7}
                minLength={3}
                maxLength={10000}
                required
              />

              <div className="input-footer">
                <span>{prompt.length.toLocaleString()} / 10,000 characters</span>
                <span>Tool execution is gateway-controlled</span>
              </div>

              {consoleMessage && (
                <div className="notice">{consoleMessage}</div>
              )}
              {dataError && <div className="notice notice-error">{dataError}</div>}

              <button
                type="submit"
                className="button button-primary run-button"
                disabled={
                  startingRun ||
                  !selectedAgentId ||
                  prompt.trim().length < 3
                }
              >
                {startingRun ? "Starting run..." : "▶  Start agent run"}
              </button>
            </form>
          </section>

          <aside className="panel console-aside">
            <h2>Execution controls</h2>
            <div className="control-item">
              <span className="control-dot control-green" />
              <div>
                <strong>Gateway enforced</strong>
                <small>Tool calls pass through policy checks.</small>
              </div>
            </div>
            <div className="control-item">
              <span className="control-dot control-green" />
              <div>
                <strong>Trace recording</strong>
                <small>LLM and tool steps are recorded per run.</small>
              </div>
            </div>
            <div className="control-item">
              <span className="control-dot control-amber" />
              <div>
                <strong>Human approval</strong>
                <small>Risky actions may pause pending a decision.</small>
              </div>
            </div>
            <div className="aside-note">
              <strong>Demo environment</strong>
              <p>
                Customer and ledger records used by this project are synthetic.
                Do not enter real customer personal information.
              </p>
            </div>
          </aside>
        </div>
      </>
    );
  } else if (page === "runs" && selectedRunId) {
    const detail = runDetail;
    const output = readOutput(detail?.run.final_output || null);

    content = (
      <>
        <div className="page-heading">
          <div>
            <button className="back-button" onClick={() => navigate("runs")}>
              ← Back to runs
            </button>
            <div className="eyebrow">EXECUTION / RUN DETAILS</div>
            <h1>Run details</h1>
            <p className="muted mono">{selectedRunId}</p>
          </div>
          {detail && <Status value={detail.run.status} />}
        </div>

        {dataLoading && !detail && <div className="loading-panel">Loading run trace...</div>}
        {dataError && <div className="notice notice-error">{dataError}</div>}

        {detail && (
          <>
            <div className="run-summary-grid">
              <MetricCard
                label="Agent"
                value={agentName(detail.run.agent_id)}
                hint="Executing agent"
                icon="AI"
              />
              <MetricCard
                label="Tokens"
                value={
                  detail.run.total_tokens == null
                    ? "Not reported"
                    : detail.run.total_tokens.toLocaleString()
                }
                hint="Recorded token usage"
                icon="#"
              />
              <MetricCard
                label="Duration"
                value={formatDuration(detail.run.started_at, detail.run.ended_at)}
                hint="From run timestamps"
                icon="◷"
              />
              <MetricCard
                label="Cost"
                value={
                  detail.run.total_cost_usd == null
                    ? "Not reported"
                    : `$${Number(detail.run.total_cost_usd).toFixed(4)}`
                }
                hint="Recorded run cost"
                icon="$"
              />
            </div>

            <section className="panel run-input-panel">
              <h2>Original instruction</h2>
              <p>{detail.run.user_input || "No input was recorded."}</p>
              <div className="run-time">
                Started {formatDate(detail.run.started_at)}
                {detail.run.ended_at
                  ? ` · Ended ${formatDate(detail.run.ended_at)}`
                  : ""}
              </div>
            </section>

            <section className="panel output-panel">
              <div className="panel-heading">
                <div>
                  <h2>Agent output</h2>
                  <p className="muted">Stored final response from the run.</p>
                </div>
                {typeof output?.confidence === "number" && (
                  <span className="confidence">
                    Confidence {(output.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {output?.answer ? (
                <p className="answer-text">{output.answer}</p>
              ) : (
                <EmptyState
                  title="No final answer"
                  description="This run has not stored a final answer."
                />
              )}

              <div className="citation-section">
                <h3>Retrieved citations</h3>
                {output?.citations?.length ? (
                  <div className="citation-list">
                    {output.citations.map((citation, index) => (
                      <div className="citation-card" key={`${citation.chunkId || citation.documentId || citation.title}-${index}`}>
                        <div className="citation-number">{index + 1}</div>
                        <div>
                          <strong>{citation.title}</strong>
                          <small>{citation.source || "Source not provided"}</small>
                          {typeof citation.score === "number" && (
                            <small>Relevance score: {citation.score.toFixed(3)}</small>
                          )}
                          {citation.documentId && (
                            <small className="mono">Document: {citation.documentId}</small>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No citations were stored for this run.</p>
                )}
              </div>
            </section>

            <section className="panel trace-panel">
              <div className="panel-heading">
                <div>
                  <h2>Execution trace</h2>
                  <p className="muted">
                    Recorded LLM calls, tool calls, policy decisions and guardrails.
                  </p>
                </div>
                <span className="panel-count">{detail.traces.length} steps</span>
              </div>

              {detail.traces.length === 0 ? (
                <EmptyState
                  title="No trace steps"
                  description="The API returned no trace records for this run."
                />
              ) : (
                <div className="trace-list">
                  {detail.traces.map((trace) => (
                    <TraceItem trace={trace} key={trace.id} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </>
    );
  } else if (page === "runs") {
    content = (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">WORKSPACE / EXECUTION</div>
            <h1>Runs</h1>
            <p className="muted">Execution history returned by the API.</p>
          </div>
          <button className="button button-primary" onClick={() => navigate("console")}>
            + New run
          </button>
        </div>

        {dataError && <div className="notice notice-error">{dataError}</div>}
        <RunTable
          runs={runs}
          agentName={agentName}
          onOpen={(id) => navigate("runs", id)}
          loading={dataLoading}
        />
      </>
    );
  } else {
    const label = currentNav?.label || "Workspace";

    content = (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">WORKSPACE / {label.toUpperCase()}</div>
            <h1>{label}</h1>
            <p className="muted">
              This workspace module is scheduled for the next frontend batch.
            </p>
          </div>
        </div>
        <section className="panel">
          <EmptyState
            title={`${label} page is not implemented yet`}
            description="This navigation item is reserved. No sample records or simulated actions are shown here."
          />
        </section>
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">P</div>
          <div>
            <strong>prohori<span>.</span></strong>
            <small>CONTROL PLANE</small>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "nav-active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "runs" && runs.length > 0 && (
                <span className="nav-count">{runs.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-system">
            <span className="system-pulse" />
            <div>
              <strong>Workspace session</strong>
              <small>Authenticated</small>
            </div>
          </div>
          <div className="sidebar-user">
            <div className="user-avatar">
              {(session.user.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="user-details">
              <strong>{session.user.email || "Workspace user"}</strong>
              <small>{profile?.role || "member"}</small>
            </div>
            <button
              className="logout-button"
              onClick={handleLogout}
              title="Sign out"
            >
              ↗
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Prohori</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{selectedRunId ? "Run details" : currentNav?.label || "Overview"}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment-tag">DEMO WORKSPACE</span>
            <span className="role-tag">{profile?.role || "member"}</span>
          </div>
        </header>

        <div className="page-content">
          {content}
          <footer className="page-footer">
            <span>PROHORI · AGENTOPS CONTROL PLANE</span>
            <span>Governed execution · Observable operations</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function RunTable({
  runs,
  agentName,
  onOpen,
  loading,
}: {
  runs: Run[];
  agentName: (id: string) => string;
  onOpen: (id: string) => void;
  loading: boolean;
}) {
  if (loading && runs.length === 0) {
    return <div className="loading-panel">Loading run records...</div>;
  }

  if (runs.length === 0) {
    return (
      <section className="panel">
        <EmptyState
          title="No runs yet"
          description="When an agent run is started, its real execution record will appear here."
        />
      </section>
    );
  }

  return (
    <section className="panel table-panel">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Agent</th>
              <th>Status</th>
              <th>Tokens</th>
              <th>Started</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <strong className="run-id">{run.id.slice(0, 8)}…</strong>
                  <small className="table-subtitle">
                    {(run.user_input || "No input").slice(0, 64)}
                  </small>
                </td>
                <td>{agentName(run.agent_id)}</td>
                <td><Status value={run.status} /></td>
                <td>
                  {run.total_tokens == null
                    ? "—"
                    : run.total_tokens.toLocaleString()}
                </td>
                <td>{formatDate(run.started_at)}</td>
                <td>
                  <button className="row-action" onClick={() => onOpen(run.id)}>
                    Open →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TraceItem({ trace }: { trace: Trace }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="trace-item">
      <div className="trace-marker">
        <span>{trace.step_no}</span>
      </div>
      <div className="trace-content">
        <button
          className="trace-header"
          onClick={() => setExpanded((value) => !value)}
        >
          <div className="trace-title">
            <strong>{trace.tool_name || trace.type.replaceAll("_", " ")}</strong>
            <small>Step {trace.step_no} · {trace.type.replaceAll("_", " ")}</small>
          </div>
          <div className="trace-meta">
            {trace.decision && <Status value={trace.decision} />}
            {typeof trace.latency_ms === "number" && (
              <span>{trace.latency_ms} ms</span>
            )}
            <span>{expanded ? "−" : "+"}</span>
          </div>
        </button>

        {trace.reason && <p className="trace-reason">{trace.reason}</p>}

        {expanded && (
          <div className="trace-expanded">
            {trace.args_redacted != null && (
              <div>
                <h4>Arguments (redacted)</h4>
                <pre>{JSON.stringify(trace.args_redacted, null, 2)}</pre>
              </div>
            )}
            {trace.result_redacted != null && (
              <div>
                <h4>Result (redacted)</h4>
                <pre>{JSON.stringify(trace.result_redacted, null, 2)}</pre>
              </div>
            )}
            <div className="trace-token-row">
              <span>Input tokens: {trace.tokens_in ?? "Not reported"}</span>
              <span>Output tokens: {trace.tokens_out ?? "Not reported"}</span>
              <span>
                Cost: {trace.cost_usd == null ? "Not reported" : `$${trace.cost_usd}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default App;