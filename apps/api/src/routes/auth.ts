import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthUser } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.get("/me", requireAuth, (_req, res) => {
  const user = res.locals.authUser as AuthUser;

  return res.status(200).json({
    success: true,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
    },
  });
});