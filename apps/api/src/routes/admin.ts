
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

export const adminRouter = Router();

adminRouter.get(
  "/demo-check",
  requireAuth,
  requireRole("admin"),
  (_req, res) => {
    return res.status(200).json({
      success: true,
      message: "Admin access granted",
    });
  },
);
