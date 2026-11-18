
import type { Request, Response, NextFunction } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireRole } from "../apps/api/src/middleware/role.js";

function createMocks(role?: "admin" | "operator" | "viewer") {
  const req = {} as Request;

  const res = {
    locals: {
      authUser: role
        ? {
            id: "test-user",
            tenantId: "test-tenant",
            role,
          }
        : undefined,
    },
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe("requireRole middleware", () => {
  it("rejects unauthenticated requests", () => {
    const { req, res, next } = createMocks();

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows an authorized admin", () => {
    const { req, res, next } = createMocks("admin");

    requireRole("admin")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a viewer from an admin-only route", () => {
    const { req, res, next } = createMocks("viewer");

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows multiple explicitly permitted roles", () => {
    const { req, res, next } = createMocks("operator");

    requireRole("admin", "operator")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
