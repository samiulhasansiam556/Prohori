import type { Request, Response, NextFunction } from "express";
import { createUserSupabaseClient } from "../lib/supabase.js";

export interface AuthUser {
  id: string;
  tenantId: string;
  role: "admin" | "operator" | "viewer";
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authorization.slice(7);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid access token",
      });
    }

    const supabase = createUserSupabaseClient(token);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session",
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({
        success: false,
        message: "User profile not found",
      });
    }

    if (!["admin", "operator", "viewer"].includes(profile.role)) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role",
      });
    }

    res.locals.authUser = {
      id: user.id,
      tenantId: profile.tenant_id,
      role: profile.role,
    } satisfies AuthUser;

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication service error",
    });
  }
}