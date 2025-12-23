import express, { type Request, type Response } from "express";
import { authRouter } from "./features/auth/index.js";
import { errorHandler, notFoundHandler } from "./lib/errors/index.js";
import { applyMiddleware } from "./lib/middleware/index.js";
import { db } from "./lib/db.js";

const app = express();

applyMiddleware(app);

// Health check endpoints
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Liveness: Is the process running? (Kubernetes restarts if this fails)
app.get("/live", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Readiness: Can we accept traffic? (Kubernetes removes from LB if this fails)
app.get("/ready", (_req: Request, res: Response) => {
  db.$queryRaw`SELECT 1`
    .then(() => {
      res.json({ status: "ok" });
    })
    .catch(() => {
      res.status(503).json({ status: "unavailable", reason: "database" });
    });
});

app.use("/api/auth", authRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
