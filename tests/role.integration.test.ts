
import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireRole } from "../apps/api/src/middleware/role.js";

const app = express();

app.use((req, res, next) => {
  const role = req.headers["x-test-role"];

  if (
    role === "admin" ||
    role === "operator" ||
    role === "viewer"
  ) {
    res.locals.authUser = {
      id: "test-user",
      tenantId: "test-tenant",
      role,
    };
  }

  next();
});

app.get("/admin", requireRole("admin"), (_req, res) => {
  res.json({ success: true });
});

app.get("/operations", requireRole("admin", "operator"), (_req, res) => {
  res.json({ success: true });
});

app.get(
  "/read-only",
  requireRole("admin", "operator", "viewer"),
  (_req, res) => {
    res.json({ success: true });
  },
);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);

  await new Promise<void>((resolve) => {
    server.once("listening", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not start test server");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

describe("RBAC HTTP integration", () => {
  it("allows admin to access admin endpoint", async () => {
    const response = await fetch(`${baseUrl}/admin`, {
      headers: { "x-test-role": "admin" },
    });

    expect(response.status).toBe(200);
  });

  it("blocks operator from admin endpoint", async () => {
    const response = await fetch(`${baseUrl}/admin`, {
      headers: { "x-test-role": "operator" },
    });

    expect(response.status).toBe(403);
  });

  it("blocks viewer from admin endpoint", async () => {
    const response = await fetch(`${baseUrl}/admin`, {
      headers: { "x-test-role": "viewer" },
    });

    expect(response.status).toBe(403);
  });

  it("allows operator to access operations endpoint", async () => {
    const response = await fetch(`${baseUrl}/operations`, {
      headers: { "x-test-role": "operator" },
    });

    expect(response.status).toBe(200);
  });

  it("allows viewer to access read-only endpoint", async () => {
    const response = await fetch(`${baseUrl}/read-only`, {
      headers: { "x-test-role": "viewer" },
    });

    expect(response.status).toBe(200);
  });

  it("rejects requests without an authenticated user", async () => {
    const response = await fetch(`${baseUrl}/admin`);

    expect(response.status).toBe(401);
  });
});
