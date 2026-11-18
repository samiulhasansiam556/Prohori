
import type { Request, Response, NextFunction } from "express";
import type { AuthUser } from "./auth.js";

type AppRole = AuthUser["role"];

export function requireRole(...allowedRoles: AppRole[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.authUser as AuthUser | undefined;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    return next();
  };
}
