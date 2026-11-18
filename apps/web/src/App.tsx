import { useEffect, useState } from "react";

interface HealthResponse {
  success: boolean;
  service: string;
  status: string;
  timestamp: string;
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("API unavailable");
        }
        return response.json();
      })
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => setError(true));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="flex items-center justify-between border-b border-slate-800 px-8 py-5">
        <h1 className="text-2xl font-bold tracking-wide">
          Prohori<span className="text-cyan-400">.</span>
        </h1>

        <span className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
          AgentOps Control Plane
        </span>
      </nav>

      <section className="mx-auto max-w-6xl px-8 py-24">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
          Govern your AI agents
        </p>

        <h2 className="max-w-3xl text-5xl font-bold leading-tight md:text-7xl">
          Secure. Monitor.
          <span className="text-cyan-400"> Control.</span>
        </h2>

        <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-400">
          Prohori is an AgentOps control plane designed to monitor, govern and secure AI agents
          through centralized policies, tool permissions and observability.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            ["01", "Agent Governance", "Control agent permissions and access."],
            ["02", "MCP Gateway", "Secure every agent tool interaction."],
            ["03", "Observability", "Track execution, decisions and cost."],
          ].map(([number, title, description]) => (
            <article key={number} className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <span className="text-sm text-cyan-400">{number}</span>
              <h3 className="mt-5 text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="font-semibold">System Health</h3>

          <div className="mt-4 flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${
                health ? "bg-green-400" : error ? "bg-red-400" : "bg-yellow-400"
              }`}
            />

            <span className="text-sm text-slate-300">
              {health ? "API Connected" : error ? "API Disconnected" : "Connecting to API..."}
            </span>
          </div>

          {health && (
            <p className="mt-3 text-xs text-slate-500">
              {health.service} · {health.status}
            </p>
          )}
        </div>
      </section>

      <footer className="border-t border-slate-800 px-8 py-6 text-center text-sm text-slate-500">
        Prohori — AgentOps Control Plane · Built for AIBC 2026
      </footer>
    </main>
  );
}

export default App;
