import { AuditAction } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../../lib/errors/index.js";
import { logAudit } from "../../../services/audit/index.js";
import type {
  AddClaimFileUploadUrlBody,
  AddClaimFileUploadUrlParams,
  CreatePendingFileUploadUrlBody,
  DeleteClaimFileParams,
  GetClaimFileDownloadUrlParams,
  ListClaimFilesParams,
} from "./schemas.js";
import {
  addClaimFileUploadUrlUseCase,
  createPendingFileUploadUrlUseCase,
  deleteClaimFileUseCase,
  getClaimFileDownloadUrlUseCase,
  listClaimFilesUseCase,
} from "./service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Pending Files
// ─────────────────────────────────────────────────────────────────────────────

export async function createPendingFileUploadUrl(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const body = req.body as CreatePendingFileUploadUrlBody;

  const result = await createPendingFileUploadUrlUseCase(user, body);

  req.log.info(
    { userId: user.id, sessionKey: result.sessionKey, pendingFileId: result.pendingFileId },
    "Pending file upload URL generated",
  );

  res.status(201).json(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim Files
// ─────────────────────────────────────────────────────────────────────────────

export async function listClaimFiles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { claimId } = req.params as ListClaimFilesParams;

  const result = await listClaimFilesUseCase(claimId);

  req.log.info(
    { userId: user.id, claimId, fileCount: result.files.length },
    "Claim files listed",
  );

  res.json(result);
}

export async function addClaimFileUploadUrl(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { claimId } = req.params as AddClaimFileUploadUrlParams;
  const body = req.body as AddClaimFileUploadUrlBody;

  const result = await addClaimFileUploadUrlUseCase(user, claimId, body);

  logAudit(
    {
      action: AuditAction.CREATE,
      resource: "claimFile",
      resourceId: result.fileId,
      metadata: {
        claimId,
        fileName: body.fileName,
        fileType: body.fileType,
      },
    },
    req,
  );

  req.log.info(
    { userId: user.id, claimId, fileId: result.fileId },
    "Claim file upload URL generated",
  );

  res.status(201).json(result);
}

export async function getClaimFileDownloadUrl(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { claimId, fileId } = req.params as GetClaimFileDownloadUrlParams;

  const result = await getClaimFileDownloadUrlUseCase(claimId, fileId);

  req.log.info(
    { userId: user.id, claimId, fileId },
    "Claim file download URL generated",
  );

  res.json(result);
}

export async function deleteClaimFile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { claimId, fileId } = req.params as DeleteClaimFileParams;

  const { fileName, fileType } = await deleteClaimFileUseCase(claimId, fileId);

  logAudit(
    {
      action: AuditAction.DELETE,
      resource: "claimFile",
      resourceId: fileId,
      metadata: { claimId, fileName, fileType },
    },
    req,
  );

  req.log.info(
    { userId: user.id, claimId, fileId },
    "Claim file deleted",
  );

  res.status(204).send();
}
