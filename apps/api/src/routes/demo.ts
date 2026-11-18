
import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createUserSupabaseClient } from "../lib/supabase.js";

export const demoRouter = Router();

const demoLoginSchema = z.object({
  role: z.enum(["admin", "viewer"]),
});

demoRouter.post("/login", async (req, res) => {
  console.log("\n========== DEMO LOGIN DEBUG ==========");
  console.log("Route reached: YES");
  console.log("Request body:", req.body);
  console.log("DEMO_LOGIN_ENABLED:", process.env.DEMO_LOGIN_ENABLED);
  console.log("NODE_ENV:", process.env.NODE_ENV);

  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    console.log("STOPPED: Demo login is disabled");

    return res.status(404).json({
      success: false,
      message: "Demo login is disabled",
    });
  }

  const parsed = demoLoginSchema.safeParse(req.body);

  if (!parsed.success) {
    console.log("STOPPED: Invalid request body");
    console.log("Validation errors:", parsed.error.issues);

    return res.status(400).json({
      success: false,
      message: "Invalid demo role",
    });
  }

  const role = parsed.data.role;

  const email =
    role === "admin"
      ? process.env.DEMO_ADMIN_EMAIL
      : process.env.DEMO_VIEWER_EMAIL;

  const password =
    role === "admin"
      ? process.env.DEMO_ADMIN_PASSWORD
      : process.env.DEMO_VIEWER_PASSWORD;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  console.log("Requested role:", role);
  console.log("Email configured:", Boolean(email));
  console.log("Password configured:", Boolean(password));
  console.log("Supabase URL configured:", Boolean(url));
  console.log("Supabase key configured:", Boolean(key));

  if (!url || !key || !email || !password) {
    console.log("STOPPED: Missing environment configuration");

    return res.status(503).json({
      success: false,
      message: "Demo login is not configured",
    });
  }

  try {
    console.log("Step 1: Creating Supabase client");

    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    console.log("Step 2: Attempting Supabase login");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log(
      "Supabase login error:",
      error?.message ?? "none",
    );
    console.log("User found:", Boolean(data.user));
    console.log("Session found:", Boolean(data.session));

    if (error || !data.session || !data.user) {
      console.log("STOPPED: Supabase authentication failed");

      return res.status(401).json({
        success: false,
        message: "Demo login failed",
      });
    }

    console.log("Step 3: Creating authenticated user client");

    const userClient = createUserSupabaseClient(
      data.session.access_token,
    );

    console.log("Step 4: Fetching user profile");

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", data.user.id)
      .single();

    console.log(
      "Profile error:",
      profileError?.message ?? "none",
    );
    console.log("Profile found:", Boolean(profile));
    console.log("Profile role:", profile?.role);
    console.log("Requested role:", role);

    if (profileError || !profile || profile.role !== role) {
      console.log("STOPPED: Profile or role verification failed");

      await supabase.auth.signOut();

      return res.status(403).json({
        success: false,
        message: "Demo account role is not configured correctly",
      });
    }

    console.log("SUCCESS: Demo login completed");
    console.log("======================================\n");

    return res.status(200).json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (error) {
    console.error("DEMO LOGIN EXCEPTION:", error);

    return res.status(500).json({
      success: false,
      message: "Demo login service error",
    });
  }
});
