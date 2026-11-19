
import express from "express";
import { authRouter } from "./routes/auth.js";
import { demoRouter } from "./routes/demo.js";
import { adminRouter } from "./routes/admin.js";

import { knowledgeRouter } from "./routes/knowledge.js";


export const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "prohori-api",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});


app.use("/api/demo", demoRouter);
app.use("/api/admin", adminRouter);

app.use("/api/knowledge", knowledgeRouter);

app.use("/api/auth", authRouter);