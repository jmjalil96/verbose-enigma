import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../../lib/errors/index.js";
import type {
  ListAffiliatesQuery,
  ListPatientsQuery,
  ListPoliciesQuery,
} from "./schemas.js";
import {
  listAffiliatesUseCase,
  listClientsUseCase,
  listPatientsUseCase,
  listPoliciesUseCase,
} from "./service.js";

// ─────────────────────────────────────────────────────────────────────────────
// List clients
// ─────────────────────────────────────────────────────────────────────────────

export async function listClients(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const clients = await listClientsUseCase(user);

  res.json({ data: clients });
}

// ─────────────────────────────────────────────────────────────────────────────
// List affiliates
// ─────────────────────────────────────────────────────────────────────────────

export async function listAffiliates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const query = req.query as unknown as ListAffiliatesQuery;
  const affiliates = await listAffiliatesUseCase(user, query);

  res.json({ data: affiliates });
}

// ─────────────────────────────────────────────────────────────────────────────
// List patients
// ─────────────────────────────────────────────────────────────────────────────

export async function listPatients(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const query = req.query as unknown as ListPatientsQuery;
  const patients = await listPatientsUseCase(user, query);

  res.json({ data: patients });
}

// ─────────────────────────────────────────────────────────────────────────────
// List policies
// ─────────────────────────────────────────────────────────────────────────────

export async function listPolicies(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const query = req.query as unknown as ListPoliciesQuery;
  const policies = await listPoliciesUseCase(user, query);

  res.json({ data: policies });
}
