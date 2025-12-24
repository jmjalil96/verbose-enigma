-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'DOMESTIC_PARTNERSHIP');

-- CreateEnum
CREATE TYPE "DependentRelationship" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'CREATE', 'UPDATE', 'DELETE', 'INVITATION_SENT', 'INVITATION_ACCEPTED', 'ROLE_ASSIGNED', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'MAGIC_LINK');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PENDING_INFO', 'RETURNED', 'CANCELLED', 'SETTLED');

-- CreateEnum
CREATE TYPE "CareType" AS ENUM ('AMBULATORY', 'HOSPITALARY', 'OTHER');

-- CreateEnum
CREATE TYPE "ClaimFileStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ClaimFileType" AS ENUM ('INVOICE', 'RECEIPT', 'MEDICAL_REPORT', 'PRESCRIPTION', 'ID_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentFileStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'VALIDATED', 'DISCREPANCY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_PAYMENT', 'PAID');

-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('EXTRA_BILLED', 'MISSING_BILLED', 'RATE_ADJUSTMENT', 'PRORATION', 'CREDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "InsurerType" AS ENUM ('MEDICINA_PREPAGADA', 'COMPANIA_DE_SEGUROS');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('HEALTH', 'LIFE', 'ACCIDENTS');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CoverageType" AS ENUM ('INDIVIDUAL', 'INDIVIDUAL_PLUS_1', 'FAMILY');

-- CreateEnum
CREATE TYPE "EnrollmentStartReason" AS ENUM ('NEW_HIRE', 'OPEN_ENROLLMENT', 'QUALIFYING_EVENT', 'REINSTATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EnrollmentEndReason" AS ENUM ('TERMINATION', 'RESIGNATION', 'RETIREMENT', 'DEATH', 'POLICY_CANCELLED', 'OTHER');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('UNLIMITED', 'CLIENT', 'SELF');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketFileStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "affiliates" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "maritalStatus" "MaritalStatus",
    "primaryAffiliateId" TEXT,
    "relationship" "DependentRelationship",
    "clientId" TEXT NOT NULL,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_files" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "sessionsInvalidBefore" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "claimNumber" INTEGER NOT NULL,
    "policyId" TEXT,
    "affiliateId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT NOT NULL,
    "careType" "CareType",
    "diagnosis" TEXT,
    "amountSubmitted" DECIMAL(12,2),
    "amountApproved" DECIMAL(12,2),
    "amountDenied" DECIMAL(12,2),
    "amountUnprocessed" DECIMAL(12,2),
    "deductibleApplied" DECIMAL(12,2),
    "copayApplied" DECIMAL(12,2),
    "incidentDate" DATE,
    "submittedDate" DATE,
    "settlementDate" DATE,
    "businessDays" INTEGER,
    "settlementNumber" TEXT,
    "settlementNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_history" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fromStatus" "ClaimStatus",
    "toStatus" "ClaimStatus" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_invoices" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "amountSubmitted" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_claim_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "fileType" "ClaimFileType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_claim_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_files" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fileType" "ClaimFileType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "targetKey" TEXT,
    "status" "ClaimFileStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "migratedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_files" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_counters" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_document_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_document_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "documentNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_files" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "targetKey" TEXT,
    "status" "DocumentFileStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "migratedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access" (
    "documentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_pkey" PRIMARY KEY ("documentId","clientId")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "affiliateId" TEXT,
    "agentId" TEXT,
    "employeeId" TEXT,
    "clientAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceSequence" SERIAL NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "billingPeriodStart" DATE NOT NULL,
    "billingPeriodEnd" DATE NOT NULL,
    "actualAmount" DECIMAL(12,2) NOT NULL,
    "actualCount" INTEGER NOT NULL,
    "taxAmount" DECIMAL(12,2),
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "paymentDate" DATE,
    "paymentNote" TEXT,
    "expectedAmount" DECIMAL(12,2),
    "expectedCount" INTEGER,
    "totalDiscrepancyAmount" DECIMAL(12,2),
    "totalDiscrepancyCountDelta" INTEGER,
    "reconciliationNote" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_history" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "fromStatus" "InvoiceStatus",
    "toStatus" "InvoiceStatus" NOT NULL,
    "fromPaymentStatus" "PaymentStatus",
    "toPaymentStatus" "PaymentStatus",
    "reason" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_policies" (
    "invoiceId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT NOT NULL,

    CONSTRAINT "invoice_policies_pkey" PRIMARY KEY ("invoiceId","policyId")
);

-- CreateTable
CREATE TABLE "invoice_discrepancy_causes" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "DiscrepancyType" NOT NULL,
    "enrollmentId" TEXT,
    "policyId" TEXT,
    "externalMemberId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "countDelta" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "invoice_discrepancy_causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_files" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "type" "InsurerType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "type" "PolicyType",
    "status" "PolicyStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "ambulatoryCoinsurancePct" DECIMAL(5,2),
    "hospitalaryCoinsurancePct" DECIMAL(5,2),
    "maternityCost" DECIMAL(12,2),
    "tPremium" DECIMAL(12,2),
    "tplus1Premium" DECIMAL(12,2),
    "tplusfPremium" DECIMAL(12,2),
    "benefitsCostPerPerson" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_enrollments" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "coverageType" "CoverageType",
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "startReason" "EnrollmentStartReason",
    "endReason" "EnrollmentEndReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_dependents" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "dependentId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_dependents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_history" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "fromStatus" "PolicyStatus",
    "toStatus" "PolicyStatus" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurer_files" (
    "id" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurer_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_files" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_files" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "department" TEXT,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "licenseNumber" TEXT,
    "agencyName" TEXT,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_clients" (
    "agentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_clients_pkey" PRIMARY KEY ("agentId","clientId")
);

-- CreateTable
CREATE TABLE "client_admins" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "jobTitle" TEXT,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_admin_clients" (
    "clientAdminId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_admin_clients_pkey" PRIMARY KEY ("clientAdminId","clientId")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "scopeType" "ScopeType" NOT NULL,
    "isPortalRole" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "pending_ticket_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_ticket_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "category" TEXT,
    "clientId" TEXT NOT NULL,
    "relatedClaimId" TEXT,
    "reporterId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_files" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "targetKey" TEXT,
    "status" "TicketFileStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "migratedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_userId_key" ON "affiliates"("userId");

-- CreateIndex
CREATE INDEX "affiliates_clientId_idx" ON "affiliates"("clientId");

-- CreateIndex
CREATE INDEX "affiliates_userId_idx" ON "affiliates"("userId");

-- CreateIndex
CREATE INDEX "affiliates_primaryAffiliateId_idx" ON "affiliates"("primaryAffiliateId");

-- CreateIndex
CREATE INDEX "affiliates_documentNumber_idx" ON "affiliates"("documentNumber");

-- CreateIndex
CREATE INDEX "affiliates_lastName_firstName_idx" ON "affiliates"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "affiliates_isActive_idx" ON "affiliates"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_files_fileKey_key" ON "affiliate_files"("fileKey");

-- CreateIndex
CREATE INDEX "affiliate_files_affiliateId_idx" ON "affiliate_files"("affiliateId");

-- CreateIndex
CREATE INDEX "affiliate_files_createdById_idx" ON "affiliate_files"("createdById");

-- CreateIndex
CREATE INDEX "affiliate_files_deletedAt_idx" ON "affiliate_files"("deletedAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "sessions_revokedAt_idx" ON "sessions"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_tokenHash_key" ON "verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "verification_tokens_userId_type_idx" ON "verification_tokens"("userId", "type");

-- CreateIndex
CREATE INDEX "verification_tokens_expiresAt_idx" ON "verification_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "claims_claimNumber_key" ON "claims"("claimNumber");

-- CreateIndex
CREATE INDEX "claims_policyId_idx" ON "claims"("policyId");

-- CreateIndex
CREATE INDEX "claims_affiliateId_idx" ON "claims"("affiliateId");

-- CreateIndex
CREATE INDEX "claims_patientId_idx" ON "claims"("patientId");

-- CreateIndex
CREATE INDEX "claims_clientId_idx" ON "claims"("clientId");

-- CreateIndex
CREATE INDEX "claims_status_idx" ON "claims"("status");

-- CreateIndex
CREATE INDEX "claims_createdById_idx" ON "claims"("createdById");

-- CreateIndex
CREATE INDEX "claims_updatedById_idx" ON "claims"("updatedById");

-- CreateIndex
CREATE INDEX "claims_submittedDate_idx" ON "claims"("submittedDate");

-- CreateIndex
CREATE INDEX "claims_settlementDate_idx" ON "claims"("settlementDate");

-- CreateIndex
CREATE INDEX "claims_createdAt_idx" ON "claims"("createdAt");

-- CreateIndex
CREATE INDEX "claim_history_claimId_idx" ON "claim_history"("claimId");

-- CreateIndex
CREATE INDEX "claim_history_createdById_idx" ON "claim_history"("createdById");

-- CreateIndex
CREATE INDEX "claim_history_createdAt_idx" ON "claim_history"("createdAt");

-- CreateIndex
CREATE INDEX "claim_invoices_claimId_idx" ON "claim_invoices"("claimId");

-- CreateIndex
CREATE INDEX "claim_invoices_createdById_idx" ON "claim_invoices"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "pending_claim_files_fileKey_key" ON "pending_claim_files"("fileKey");

-- CreateIndex
CREATE INDEX "pending_claim_files_userId_sessionKey_idx" ON "pending_claim_files"("userId", "sessionKey");

-- CreateIndex
CREATE INDEX "pending_claim_files_expiresAt_idx" ON "pending_claim_files"("expiresAt");

-- CreateIndex
CREATE INDEX "claim_files_claimId_idx" ON "claim_files"("claimId");

-- CreateIndex
CREATE INDEX "claim_files_status_idx" ON "claim_files"("status");

-- CreateIndex
CREATE INDEX "claim_files_createdById_idx" ON "claim_files"("createdById");

-- CreateIndex
CREATE INDEX "claim_files_deletedAt_idx" ON "claim_files"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "client_files_fileKey_key" ON "client_files"("fileKey");

-- CreateIndex
CREATE INDEX "client_files_clientId_idx" ON "client_files"("clientId");

-- CreateIndex
CREATE INDEX "client_files_createdById_idx" ON "client_files"("createdById");

-- CreateIndex
CREATE INDEX "client_files_deletedAt_idx" ON "client_files"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_document_files_fileKey_key" ON "pending_document_files"("fileKey");

-- CreateIndex
CREATE INDEX "pending_document_files_userId_sessionKey_idx" ON "pending_document_files"("userId", "sessionKey");

-- CreateIndex
CREATE INDEX "pending_document_files_expiresAt_idx" ON "pending_document_files"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "documents_documentNumber_key" ON "documents"("documentNumber");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "documents_isPublic_idx" ON "documents"("isPublic");

-- CreateIndex
CREATE INDEX "documents_isActive_idx" ON "documents"("isActive");

-- CreateIndex
CREATE INDEX "documents_createdById_idx" ON "documents"("createdById");

-- CreateIndex
CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt");

-- CreateIndex
CREATE INDEX "document_files_documentId_idx" ON "document_files"("documentId");

-- CreateIndex
CREATE INDEX "document_files_status_idx" ON "document_files"("status");

-- CreateIndex
CREATE INDEX "document_files_createdById_idx" ON "document_files"("createdById");

-- CreateIndex
CREATE INDEX "document_files_deletedAt_idx" ON "document_files"("deletedAt");

-- CreateIndex
CREATE INDEX "document_access_documentId_idx" ON "document_access"("documentId");

-- CreateIndex
CREATE INDEX "document_access_clientId_idx" ON "document_access"("clientId");

-- CreateIndex
CREATE INDEX "document_access_grantedById_idx" ON "document_access"("grantedById");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_affiliateId_key" ON "invitations"("affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_agentId_key" ON "invitations"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_employeeId_key" ON "invitations"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_clientAdminId_key" ON "invitations"("clientAdminId");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_expiresAt_idx" ON "invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "invitations_roleId_idx" ON "invitations"("roleId");

-- CreateIndex
CREATE INDEX "invitations_createdById_idx" ON "invitations"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceSequence_key" ON "invoices"("invoiceSequence");

-- CreateIndex
CREATE INDEX "invoices_invoiceNumber_idx" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_insurerId_idx" ON "invoices"("insurerId");

-- CreateIndex
CREATE INDEX "invoices_clientId_idx" ON "invoices"("clientId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_paymentStatus_idx" ON "invoices"("paymentStatus");

-- CreateIndex
CREATE INDEX "invoices_issueDate_idx" ON "invoices"("issueDate");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE INDEX "invoices_createdById_idx" ON "invoices"("createdById");

-- CreateIndex
CREATE INDEX "invoices_updatedById_idx" ON "invoices"("updatedById");

-- CreateIndex
CREATE INDEX "invoice_history_invoiceId_idx" ON "invoice_history"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_history_toStatus_idx" ON "invoice_history"("toStatus");

-- CreateIndex
CREATE INDEX "invoice_history_createdById_idx" ON "invoice_history"("createdById");

-- CreateIndex
CREATE INDEX "invoice_history_createdAt_idx" ON "invoice_history"("createdAt");

-- CreateIndex
CREATE INDEX "invoice_policies_invoiceId_idx" ON "invoice_policies"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_policies_policyId_idx" ON "invoice_policies"("policyId");

-- CreateIndex
CREATE INDEX "invoice_policies_addedById_idx" ON "invoice_policies"("addedById");

-- CreateIndex
CREATE INDEX "invoice_discrepancy_causes_invoiceId_idx" ON "invoice_discrepancy_causes"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_discrepancy_causes_enrollmentId_idx" ON "invoice_discrepancy_causes"("enrollmentId");

-- CreateIndex
CREATE INDEX "invoice_discrepancy_causes_policyId_idx" ON "invoice_discrepancy_causes"("policyId");

-- CreateIndex
CREATE INDEX "invoice_discrepancy_causes_type_idx" ON "invoice_discrepancy_causes"("type");

-- CreateIndex
CREATE INDEX "invoice_discrepancy_causes_createdById_idx" ON "invoice_discrepancy_causes"("createdById");

-- CreateIndex
CREATE INDEX "invoice_discrepancy_causes_deletedAt_idx" ON "invoice_discrepancy_causes"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_files_fileKey_key" ON "invoice_files"("fileKey");

-- CreateIndex
CREATE INDEX "invoice_files_invoiceId_idx" ON "invoice_files"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_files_createdById_idx" ON "invoice_files"("createdById");

-- CreateIndex
CREATE INDEX "invoice_files_deletedAt_idx" ON "invoice_files"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "insurers_name_key" ON "insurers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "insurers_code_key" ON "insurers"("code");

-- CreateIndex
CREATE INDEX "insurers_isActive_idx" ON "insurers"("isActive");

-- CreateIndex
CREATE INDEX "policies_policyNumber_idx" ON "policies"("policyNumber");

-- CreateIndex
CREATE INDEX "policies_clientId_idx" ON "policies"("clientId");

-- CreateIndex
CREATE INDEX "policies_insurerId_idx" ON "policies"("insurerId");

-- CreateIndex
CREATE INDEX "policies_status_idx" ON "policies"("status");

-- CreateIndex
CREATE INDEX "policies_startDate_endDate_idx" ON "policies"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "policies_policyNumber_insurerId_key" ON "policies"("policyNumber", "insurerId");

-- CreateIndex
CREATE INDEX "policy_enrollments_policyId_idx" ON "policy_enrollments"("policyId");

-- CreateIndex
CREATE INDEX "policy_enrollments_affiliateId_idx" ON "policy_enrollments"("affiliateId");

-- CreateIndex
CREATE INDEX "policy_enrollments_coverageType_idx" ON "policy_enrollments"("coverageType");

-- CreateIndex
CREATE INDEX "policy_enrollments_startDate_idx" ON "policy_enrollments"("startDate");

-- CreateIndex
CREATE INDEX "policy_enrollments_endDate_idx" ON "policy_enrollments"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "policy_enrollments_policyId_affiliateId_startDate_key" ON "policy_enrollments"("policyId", "affiliateId", "startDate");

-- CreateIndex
CREATE INDEX "enrollment_dependents_enrollmentId_idx" ON "enrollment_dependents"("enrollmentId");

-- CreateIndex
CREATE INDEX "enrollment_dependents_dependentId_idx" ON "enrollment_dependents"("dependentId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_dependents_enrollmentId_dependentId_addedAt_key" ON "enrollment_dependents"("enrollmentId", "dependentId", "addedAt");

-- CreateIndex
CREATE INDEX "policy_history_policyId_idx" ON "policy_history"("policyId");

-- CreateIndex
CREATE INDEX "policy_history_createdById_idx" ON "policy_history"("createdById");

-- CreateIndex
CREATE INDEX "policy_history_createdAt_idx" ON "policy_history"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "insurer_files_fileKey_key" ON "insurer_files"("fileKey");

-- CreateIndex
CREATE INDEX "insurer_files_insurerId_idx" ON "insurer_files"("insurerId");

-- CreateIndex
CREATE INDEX "insurer_files_createdById_idx" ON "insurer_files"("createdById");

-- CreateIndex
CREATE INDEX "insurer_files_deletedAt_idx" ON "insurer_files"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "policy_files_fileKey_key" ON "policy_files"("fileKey");

-- CreateIndex
CREATE INDEX "policy_files_policyId_idx" ON "policy_files"("policyId");

-- CreateIndex
CREATE INDEX "policy_files_createdById_idx" ON "policy_files"("createdById");

-- CreateIndex
CREATE INDEX "policy_files_deletedAt_idx" ON "policy_files"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_files_fileKey_key" ON "enrollment_files"("fileKey");

-- CreateIndex
CREATE INDEX "enrollment_files_enrollmentId_idx" ON "enrollment_files"("enrollmentId");

-- CreateIndex
CREATE INDEX "enrollment_files_createdById_idx" ON "enrollment_files"("createdById");

-- CreateIndex
CREATE INDEX "enrollment_files_deletedAt_idx" ON "enrollment_files"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_isActive_idx" ON "employees"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "agents_email_key" ON "agents"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agents_userId_key" ON "agents"("userId");

-- CreateIndex
CREATE INDEX "agents_email_idx" ON "agents"("email");

-- CreateIndex
CREATE INDEX "agents_isActive_idx" ON "agents"("isActive");

-- CreateIndex
CREATE INDEX "agent_clients_clientId_idx" ON "agent_clients"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_admins_email_key" ON "client_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "client_admins_userId_key" ON "client_admins"("userId");

-- CreateIndex
CREATE INDEX "client_admins_email_idx" ON "client_admins"("email");

-- CreateIndex
CREATE INDEX "client_admins_isActive_idx" ON "client_admins"("isActive");

-- CreateIndex
CREATE INDEX "client_admin_clients_clientId_idx" ON "client_admin_clients"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "permissions_resource_idx" ON "permissions"("resource");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "pending_ticket_files_fileKey_key" ON "pending_ticket_files"("fileKey");

-- CreateIndex
CREATE INDEX "pending_ticket_files_userId_sessionKey_idx" ON "pending_ticket_files"("userId", "sessionKey");

-- CreateIndex
CREATE INDEX "pending_ticket_files_expiresAt_idx" ON "pending_ticket_files"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticketNumber_key" ON "tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "tickets_clientId_idx" ON "tickets"("clientId");

-- CreateIndex
CREATE INDEX "tickets_relatedClaimId_idx" ON "tickets"("relatedClaimId");

-- CreateIndex
CREATE INDEX "tickets_reporterId_idx" ON "tickets"("reporterId");

-- CreateIndex
CREATE INDEX "tickets_createdById_idx" ON "tickets"("createdById");

-- CreateIndex
CREATE INDEX "tickets_assignedToId_idx" ON "tickets"("assignedToId");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_priority_idx" ON "tickets"("priority");

-- CreateIndex
CREATE INDEX "tickets_category_idx" ON "tickets"("category");

-- CreateIndex
CREATE INDEX "tickets_createdAt_idx" ON "tickets"("createdAt");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_idx" ON "ticket_messages"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_messages_authorId_idx" ON "ticket_messages"("authorId");

-- CreateIndex
CREATE INDEX "ticket_messages_createdAt_idx" ON "ticket_messages"("createdAt");

-- CreateIndex
CREATE INDEX "ticket_files_messageId_idx" ON "ticket_files"("messageId");

-- CreateIndex
CREATE INDEX "ticket_files_status_idx" ON "ticket_files"("status");

-- CreateIndex
CREATE INDEX "ticket_files_createdById_idx" ON "ticket_files"("createdById");

-- CreateIndex
CREATE INDEX "ticket_files_deletedAt_idx" ON "ticket_files"("deletedAt");

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_primaryAffiliateId_fkey" FOREIGN KEY ("primaryAffiliateId") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_files" ADD CONSTRAINT "affiliate_files_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_files" ADD CONSTRAINT "affiliate_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_history" ADD CONSTRAINT "claim_history_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_history" ADD CONSTRAINT "claim_history_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_invoices" ADD CONSTRAINT "claim_invoices_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_invoices" ADD CONSTRAINT "claim_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_claim_files" ADD CONSTRAINT "pending_claim_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_files" ADD CONSTRAINT "claim_files_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_files" ADD CONSTRAINT "claim_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_document_files" ADD CONSTRAINT "pending_document_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access" ADD CONSTRAINT "document_access_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access" ADD CONSTRAINT "document_access_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access" ADD CONSTRAINT "document_access_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_clientAdminId_fkey" FOREIGN KEY ("clientAdminId") REFERENCES "client_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_history" ADD CONSTRAINT "invoice_history_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_history" ADD CONSTRAINT "invoice_history_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_policies" ADD CONSTRAINT "invoice_policies_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_policies" ADD CONSTRAINT "invoice_policies_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_policies" ADD CONSTRAINT "invoice_policies_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_discrepancy_causes" ADD CONSTRAINT "invoice_discrepancy_causes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_discrepancy_causes" ADD CONSTRAINT "invoice_discrepancy_causes_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "policy_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_discrepancy_causes" ADD CONSTRAINT "invoice_discrepancy_causes_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_discrepancy_causes" ADD CONSTRAINT "invoice_discrepancy_causes_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_discrepancy_causes" ADD CONSTRAINT "invoice_discrepancy_causes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_files" ADD CONSTRAINT "invoice_files_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_files" ADD CONSTRAINT "invoice_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_enrollments" ADD CONSTRAINT "policy_enrollments_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_enrollments" ADD CONSTRAINT "policy_enrollments_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_dependents" ADD CONSTRAINT "enrollment_dependents_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "policy_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_dependents" ADD CONSTRAINT "enrollment_dependents_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_history" ADD CONSTRAINT "policy_history_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_history" ADD CONSTRAINT "policy_history_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurer_files" ADD CONSTRAINT "insurer_files_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurer_files" ADD CONSTRAINT "insurer_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_files" ADD CONSTRAINT "policy_files_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_files" ADD CONSTRAINT "policy_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_files" ADD CONSTRAINT "enrollment_files_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "policy_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_files" ADD CONSTRAINT "enrollment_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_clients" ADD CONSTRAINT "agent_clients_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_clients" ADD CONSTRAINT "agent_clients_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_admins" ADD CONSTRAINT "client_admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_admin_clients" ADD CONSTRAINT "client_admin_clients_clientAdminId_fkey" FOREIGN KEY ("clientAdminId") REFERENCES "client_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_admin_clients" ADD CONSTRAINT "client_admin_clients_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_ticket_files" ADD CONSTRAINT "pending_ticket_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_relatedClaimId_fkey" FOREIGN KEY ("relatedClaimId") REFERENCES "claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_files" ADD CONSTRAINT "ticket_files_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ticket_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_files" ADD CONSTRAINT "ticket_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
