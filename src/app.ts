import express, { type Request, type Response } from "express";
import { applyMiddleware } from "./lib/middleware/index.js";
import { errorHandler, notFoundHandler } from "./lib/errors/index.js";

const app = express();

applyMiddleware(app);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
