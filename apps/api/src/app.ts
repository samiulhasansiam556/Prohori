import express from "express";

export const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "prohori-api",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});
