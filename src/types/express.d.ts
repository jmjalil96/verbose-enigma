import type { Logger } from "pino";
import type { SessionUser } from "../lib/auth/types.js";

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
      user?: SessionUser;
    }
  }
}

export {};
