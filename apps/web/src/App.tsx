
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase.js";

interface Profile {
  id: string;
  tenantId: string;
  role: "admin" | "operator" | "viewer";
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permissionResult, setPermissionResult] = useState("");

  async function loadProfile(accessToken: string) {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load user profile");
      }

      setProfile(data.user);
    } catch (err) {
      setProfile(null);
      setError(
        err instanceof Error ? err.message : "Unable to load profile",
      );
    }
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      const { data } = await supabase.auth.getSession();

      if (!active) return;

      setSession(data.session);

      if (data.session) {
        await loadProfile(data.session.access_token);
      }

      if (active) setLoading(false);
    }

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (!newSession) {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);


  async function handleDemoLogin(role: "admin" | "viewer") {
  setError("");
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

    const { data, error: sessionError } =
      await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

    if (sessionError || !data.session) {
      throw new Error(sessionError?.message || "Could not create session");
    }

    setSession(data.session);
    await loadProfile(data.session.access_token);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Demo login failed");
  } finally {
    setLoading(false);
  }
}

async function testAdminAccess() {
  if (!session) return;

  setPermissionResult("Checking...");

  try {
    const response = await fetch(`${API_URL}/api/admin/demo-check`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json();

    setPermissionResult(
      `${response.status}: ${result.message}`,
    );
  } catch {
    setPermissionResult("Could not reach API");
  }
}
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError || !data.session) {
      setError(loginError?.message || "Login failed");
      setLoading(false);
      return;
    }

    setSession(data.session);
    await loadProfile(data.session.access_token);
    setLoading(false);
  }

  async function handleLogout() {
    setError("");
    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      return;
    }

    setSession(null);
    setProfile(null);
    setPassword("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading Prohori...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12 border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-bold">
            Prohori<span className="text-cyan-400">.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            AgentOps Control Plane
          </p>
        </header>

        {!session ? (
          <section className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
            <h2 className="text-2xl font-bold">Welcome back</h2>
            <p className="mb-8 mt-2 text-sm text-slate-400">
              Sign in to access your Prohori workspace.
            </p>

            <div className="mb-6 grid grid-cols-2 gap-3">
  <button
    onClick={() => handleDemoLogin("admin")}
    disabled={loading}
    className="rounded-lg bg-cyan-500 px-3 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
  >
    Demo Admin
  </button>

  <button
    onClick={() => handleDemoLogin("viewer")}
    disabled={loading}
    className="rounded-lg border border-slate-600 px-3 py-3 font-semibold hover:bg-slate-800 disabled:opacity-50"
  >
    Demo User
  </button>
</div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                  placeholder="Enter your password"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                Sign In
              </button>
            </form>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Signed in as</p>
                <h2 className="mt-1 text-xl font-semibold">
                  {session.user.email}
                </h2>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
              >
                Sign Out
              </button>
            </div>

            <div className="mt-8 border-t border-slate-800 pt-6">
              <h3 className="font-semibold">Account Profile</h3>

              {profile ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p>
                    Role:{" "}
                    <span className="font-semibold text-cyan-400">
                      {profile.role.toUpperCase()}
                    </span>
                  </p>
                  <p className="break-all text-slate-400">
                    Tenant ID: {profile.tenantId}
                  </p>
                  <p className="text-green-400">
                    API authentication successful
                  </p>

                  <div className="mt-6 border-t border-slate-800 pt-5">
  <p className="mb-3 text-sm text-slate-400">
    Role permission verification
  </p>

  <button
    onClick={testAdminAccess}
    className="rounded-lg border border-cyan-500 px-4 py-2 text-sm text-cyan-400 hover:bg-slate-800"
  >
    Test Admin-only API
  </button>

  {permissionResult && (
    <p className="mt-3 text-sm text-cyan-300">
      {permissionResult}
    </p>
  )}

  <p className="mt-4 text-sm text-slate-400">
    {profile?.role === "admin"
      ? "You have full administrative access."
      : profile?.role === "operator"
        ? "You can manage day-to-day agent operations."
        : "Read-only access. You cannot perform administrative actions."}
  </p>
</div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-amber-400">
                  {error || "Profile could not be loaded."}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
