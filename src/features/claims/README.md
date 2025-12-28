# Claims Module

Insurance claims management with file uploads, invoices, audit logging, and a state machine for claim lifecycle.

## Base URL

```
/api/claims
```

---

## Authorization

All endpoints require authentication. Scoping is based on `user.role.scopeType`:

| Scope | Description |
|-------|-------------|
| `UNLIMITED` | Access all claims across all clients |
| `CLIENT` | Access claims only for assigned clients (via Agent or ClientAdmin) |
| `SELF` | Access only own claims (affiliate's claims) |

**Permissions used:**

- `claims:read` - View claims, files, invoices
- `claims:create` - Create new claims
- `claims:edit` - Update claims, manage files/invoices, transition status

---

## Claim Lifecycle

Claims follow a state machine with controlled transitions:

```
                    ┌─────────────┐
                    │    DRAFT    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
              ┌─────│  IN_REVIEW  │─────┐
              │     └──────┬──────┘     │
              │            │            │
       ┌──────▼──────┐     │     ┌──────▼──────┐
       │  RETURNED   │     │     │  CANCELLED  │
       └──────┬──────┘     │     └─────────────┘
              │            │
              └─────┬──────┘
                    │
             ┌──────▼──────┐
             │  SUBMITTED  │
             └──────┬──────┘
                    │
             ┌──────▼──────┐
             │   SETTLED   │
             └─────────────┘
```

| Status | Editable Fields | Next Allowed |
|--------|-----------------|--------------|
| `DRAFT` | Core fields | `IN_REVIEW` |
| `IN_REVIEW` | Core + submission | `SUBMITTED`, `RETURNED`, `CANCELLED` |
| `RETURNED` | Core fields | `IN_REVIEW` |
| `SUBMITTED` | Core + submission + settlement | `SETTLED`, `CANCELLED` |
| `SETTLED` | None (terminal) | - |
| `CANCELLED` | None (terminal) | - |

**Core fields:** `policyId`, `description`, `careType`, `diagnosis`, `incidentDate`
**Submission fields:** `amountSubmitted`, `submittedDate`
**Settlement fields:** `amountApproved`, `amountDenied`, `amountUnprocessed`, `deductibleApplied`, `copayApplied`, `settlementDate`, `settlementNumber`, `settlementNotes`

---

## Endpoints

### Claims

#### `GET /`

List claims with filtering and pagination.

**Auth:** Required
**Permission:** `claims:read`
**Scope:** Filtered by user's scope

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `clientId` | string | Filter by client |
| `affiliateId` | string | Filter by affiliate (policy holder) |
| `patientId` | string | Filter by patient |
| `policyId` | string | Filter by policy |
| `status` | string | Comma-separated statuses: `DRAFT,IN_REVIEW` |
| `careType` | string | `AMBULATORY` or `HOSPITALIZATION` |
| `search` | string | Search claim number, diagnosis, names |
| `createdFrom`, `createdTo` | date | Created date range |
| `submittedFrom`, `submittedTo` | date | Submitted date range |
| `settlementFrom`, `settlementTo` | date | Settlement date range |
| `incidentFrom`, `incidentTo` | date | Incident date range |
| `amountSubmittedMin`, `amountSubmittedMax` | number | Submitted amount range |
| `amountApprovedMin`, `amountApprovedMax` | number | Approved amount range |

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "clx...",
      "claimNumber": 1001,
      "status": "DRAFT",
      "description": "Medical consultation",
      "careType": "AMBULATORY",
      "diagnosis": null,
      "incidentDate": null,
      "amountSubmitted": null,
      "submittedDate": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "client": { "id": "...", "name": "Acme Corp" },
      "affiliate": { "id": "...", "firstName": "John", "lastName": "Doe" },
      "patient": { "id": "...", "firstName": "Jane", "lastName": "Doe" },
      "policy": null,
      "createdBy": { "id": "...", "email": "agent@example.com" }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

#### `GET /:id`

Get claim details.

**Auth:** Required
**Permission:** `claims:read`
**Scope:** Must have access to claim's client/affiliate

**Response:** `200 OK`

```json
{
  "id": "clx...",
  "claimNumber": 1001,
  "status": "SUBMITTED",
  "description": "Medical consultation",
  "careType": "AMBULATORY",
  "diagnosis": "Routine checkup",
  "incidentDate": "2024-01-10T00:00:00.000Z",
  "amountSubmitted": "150.00",
  "submittedDate": "2024-01-15T00:00:00.000Z",
  "amountApproved": null,
  "amountDenied": null,
  "amountUnprocessed": null,
  "deductibleApplied": null,
  "copayApplied": null,
  "settlementDate": null,
  "settlementNumber": null,
  "settlementNotes": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-16T14:00:00.000Z",
  "client": { "id": "...", "name": "Acme Corp" },
  "affiliate": { "id": "...", "firstName": "John", "lastName": "Doe" },
  "patient": { "id": "...", "firstName": "Jane", "lastName": "Doe" },
  "policy": { "id": "...", "policyNumber": "POL-2024-001" },
  "createdBy": { "id": "...", "email": "agent@example.com" }
}
```

**Errors:**

| Status | Code | Cause |
|--------|------|-------|
| 404 | NOT_FOUND | Claim not found or no access |

---

#### `POST /`

Create a new claim.

**Auth:** Required
**Permission:** `claims:create`
**Scope:** Must have access to client/affiliate

**Request:**

```json
{
  "clientId": "clx...",
  "affiliateId": "clx...",
  "patientId": "clx...",
  "description": "Medical consultation",
  "sessionKey": "uuid-for-pending-files"
}
```

**Notes:**

- `affiliateId` is the policy holder
- `patientId` is who received care (can be affiliate or dependent)
- `sessionKey` links pending files uploaded before claim creation

**Response:** `201 Created`

```json
{
  "id": "clx...",
  "claimNumber": 1001,
  "status": "DRAFT",
  "files": [
    {
      "id": "file-id",
      "fileName": "receipt.pdf",
      "fileType": "RECEIPT",
      "status": "PENDING"
    }
  ]
}
```

**Errors:**

| Status | Code | Cause |
|--------|------|-------|
| 400 | BAD_REQUEST | Invalid patient (not affiliate or dependent) |
| 403 | FORBIDDEN | No access to client/affiliate |
| 404 | NOT_FOUND | Client, affiliate, or patient not found |

---

#### `PATCH /:id`

Update claim fields.

**Auth:** Required
**Permission:** `claims:edit`
**Scope:** `UNLIMITED` only

**Request:**

```json
{
  "policyId": "policy-id",
  "description": "Updated description",
  "careType": "HOSPITALIZATION",
  "diagnosis": "Appendectomy",
  "incidentDate": "2024-01-10",
  "amountSubmitted": "1500.00",
  "submittedDate": "2024-01-15"
}
```

**Notes:**

- Only fields allowed by current status can be updated (see state machine)
- Amounts use string format: `"1234.56"`

**Response:** `200 OK` - Returns updated claim

**Errors:**

| Status | Code | Cause |
|--------|------|-------|
| 400 | BAD_REQUEST | Field not editable in current status |
| 403 | FORBIDDEN | Scope not UNLIMITED |
| 404 | NOT_FOUND | Claim not found |

---

#### `POST /:id/transition`

Transition claim to new status.

**Auth:** Required
**Permission:** `claims:edit`
**Scope:** `UNLIMITED` only

**Request:**

```json
{
  "toStatus": "IN_REVIEW",
  "reason": "Missing documentation",
  "notes": "Please upload insurance card"
}
```

**Notes:**

- `reason` required for: `IN_REVIEW` → `RETURNED`
- `notes` is optional additional context

**Response:** `200 OK` - Returns updated claim

**Errors:**

| Status | Code | Cause |
|--------|------|-------|
| 400 | BAD_REQUEST | Invalid transition or missing required reason |
| 409 | CONFLICT | Concurrent modification detected |

---

### Claim Files

Files are uploaded in two phases:
1. Get signed upload URL
2. Upload directly to S3

#### `POST /pending-files`

Get upload URL for files before claim creation.

**Auth:** Required
**Permission:** `claims:create`

**Request:**

```json
{
  "fileName": "receipt.pdf",
  "fileType": "RECEIPT",
  "contentType": "application/pdf",
  "fileSize": 102400,
  "sessionKey": "uuid-generated-by-frontend"
}
```

**File types:** `RECEIPT`, `PRESCRIPTION`, `MEDICAL_REPORT`, `LAB_RESULT`, `IMAGING`, `OTHER`

**Response:** `201 Created`

```json
{
  "pendingFileId": "pending-file-id",
  "sessionKey": "uuid...",
  "uploadUrl": "https://s3.../presigned-url",
  "uploadHeaders": {
    "Content-Type": "application/pdf"
  }
}
```

---

#### `GET /:claimId/files`

List claim files.

**Auth:** Required
**Permission:** `claims:read`

**Response:** `200 OK`

```json
{
  "files": [
    {
      "id": "file-id",
      "fileName": "receipt.pdf",
      "fileType": "RECEIPT",
      "fileSize": 102400,
      "contentType": "application/pdf",
      "status": "READY",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**File statuses:** `PENDING` (uploading), `READY` (available), `FAILED` (upload failed)

---

#### `POST /:claimId/files`

Add file to existing claim.

**Auth:** Required
**Permission:** `claims:edit`
**Scope:** `UNLIMITED` only

**Request:**

```json
{
  "fileName": "lab-results.pdf",
  "fileType": "LAB_RESULT",
  "contentType": "application/pdf",
  "fileSize": 51200
}
```

**Response:** `201 Created`

```json
{
  "fileId": "file-id",
  "uploadUrl": "https://s3.../presigned-url",
  "uploadHeaders": {
    "Content-Type": "application/pdf"
  }
}
```

---

#### `GET /:claimId/files/:fileId/download`

Get signed download URL.

**Auth:** Required
**Permission:** `claims:read`

**Response:** `200 OK`

```json
{
  "downloadUrl": "https://s3.../presigned-url",
  "fileName": "receipt.pdf",
  "contentType": "application/pdf"
}
```

---

#### `DELETE /:claimId/files/:fileId`

Soft delete a file.

**Auth:** Required
**Permission:** `claims:edit`
**Scope:** `UNLIMITED` only

**Response:** `204 No Content`

---

### Claim Invoices

#### `GET /:claimId/invoices`

List invoices for a claim.

**Auth:** Required
**Permission:** `claims:read`
**Scope:** `UNLIMITED` only

**Response:** `200 OK`

```json
{
  "invoices": [
    {
      "id": "invoice-id",
      "invoiceNumber": "INV-001",
      "invoiceDate": "2024-01-10",
      "providerName": "City Hospital",
      "providerTaxId": "123456789",
      "amountSubmitted": "500.00",
      "amountApproved": "450.00",
      "amountDenied": "50.00",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

#### `POST /:claimId/invoices`

Add invoice to claim.

**Auth:** Required
**Permission:** `claims:edit`
**Scope:** `UNLIMITED` only

**Request:**

```json
{
  "invoiceNumber": "INV-001",
  "invoiceDate": "2024-01-10",
  "providerName": "City Hospital",
  "providerTaxId": "123456789",
  "amountSubmitted": "500.00"
}
```

**Response:** `201 Created` - Returns created invoice

---

#### `GET /:claimId/invoices/:invoiceId`

Get invoice details.

**Auth:** Required
**Permission:** `claims:read`
**Scope:** `UNLIMITED` only

**Response:** `200 OK` - Returns invoice object

---

#### `PATCH /:claimId/invoices/:invoiceId`

Update invoice.

**Auth:** Required
**Permission:** `claims:edit`
**Scope:** `UNLIMITED` only

**Request:**

```json
{
  "amountApproved": "450.00",
  "amountDenied": "50.00"
}
```

**Response:** `200 OK` - Returns updated invoice

---

#### `DELETE /:claimId/invoices/:invoiceId`

Delete invoice.

**Auth:** Required
**Permission:** `claims:edit`
**Scope:** `UNLIMITED` only

**Response:** `204 No Content`

---

### Claim Audit

#### `GET /:claimId/audit`

Get audit history for a claim.

**Auth:** Required
**Permission:** `claims:read`
**Scope:** `UNLIMITED` only

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "log-id",
      "action": "STATUS_CHANGE",
      "resource": "claim",
      "metadata": {
        "fromStatus": "DRAFT",
        "toStatus": "IN_REVIEW"
      },
      "user": {
        "id": "user-id",
        "email": "agent@example.com"
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

**Audit actions:** `CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`

---

### Lookups

Lookup endpoints for populating dropdowns during claim creation/editing.

#### `GET /lookups/clients`

Get accessible clients.

**Auth:** Required
**Permission:** `claims:create`
**Scope:** Filtered by user's scope

**Response:** `200 OK`

```json
{
  "data": [
    { "id": "client-id", "name": "Acme Corp" },
    { "id": "client-id-2", "name": "Tech Inc" }
  ]
}
```

---

#### `GET /lookups/affiliates`

Search affiliates (policy holders) in a client.

**Auth:** Required
**Permission:** `claims:create`
**Scope:** Must have access to requested client

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | string | Yes | Client to search in |
| `q` | string | No | Search by first/last name (min 2 chars) |
| `limit` | number | No | Max results (default: 20, max: 50) |

**Response:** `200 OK`

```json
{
  "data": [
    { "id": "affiliate-id", "firstName": "John", "lastName": "Doe" },
    { "id": "affiliate-id-2", "firstName": "Jane", "lastName": "Smith" }
  ]
}
```

**Notes:**

- Returns only main affiliates (not dependents)
- Use for typeahead search

---

#### `GET /lookups/patients`

Get patients for an affiliate (affiliate + their dependents).

**Auth:** Required
**Permission:** `claims:create`
**Scope:** Must have access to affiliate's client

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `affiliateId` | string | Yes | The policy holder |

**Response:** `200 OK`

```json
{
  "data": [
    { "id": "affiliate-id", "firstName": "John", "lastName": "Doe", "primaryAffiliateId": null },
    { "id": "dependent-id", "firstName": "Jane", "lastName": "Doe", "primaryAffiliateId": "affiliate-id" },
    { "id": "dependent-id-2", "firstName": "Jimmy", "lastName": "Doe", "primaryAffiliateId": "affiliate-id" }
  ]
}
```

**Notes:**

- Main affiliate listed first (`primaryAffiliateId: null`)
- Dependents have `primaryAffiliateId` set to parent

---

#### `GET /lookups/policies`

Get all policies for a client.

**Auth:** Required
**Permission:** `claims:edit`
**Scope:** `UNLIMITED` only

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | string | Yes | Client to get policies for |

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "policy-id",
      "policyNumber": "POL-2024-001",
      "type": "HEALTH",
      "status": "ACTIVE",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-12-31T00:00:00.000Z",
      "insurer": { "id": "insurer-id", "name": "Blue Cross" }
    }
  ]
}
```

**Notes:**

- Returns all policies regardless of status
- Used when editing claims (assigning policy)

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Claim not found",
    "details": []
  },
  "requestId": "uuid",
  "errorId": "uuid"
}
```

---

## Frontend Integration

### Creating a Claim

```typescript
// 1. Generate session key for file uploads
const sessionKey = crypto.randomUUID();

// 2. Upload files before creating claim
async function uploadPendingFile(file: File, fileType: string) {
  // Get upload URL
  const res = await fetch('/api/claims/pending-files', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileType,
      contentType: file.type,
      fileSize: file.size,
      sessionKey,
    }),
  });

  const { uploadUrl, uploadHeaders } = await res.json();

  // Upload to S3
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body: file,
  });
}

// 3. Create claim with sessionKey
async function createClaim(data: ClaimData) {
  const res = await fetch('/api/claims', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, sessionKey }),
  });

  return res.json();
}
```

### Claim Creation Form Flow

```typescript
// 1. Load clients for dropdown
const clients = await fetch('/api/claims/lookups/clients', {
  credentials: 'include'
}).then(r => r.json());

// 2. When client selected, search affiliates
const affiliates = await fetch(
  `/api/claims/lookups/affiliates?clientId=${clientId}&q=${search}`,
  { credentials: 'include' }
).then(r => r.json());

// 3. When affiliate selected, load patients
const patients = await fetch(
  `/api/claims/lookups/patients?affiliateId=${affiliateId}`,
  { credentials: 'include' }
).then(r => r.json());

// 4. Create claim
await createClaim({
  clientId,
  affiliateId,
  patientId,
  description,
});
```

### Handling Status Transitions

```typescript
async function transitionClaim(
  claimId: string,
  toStatus: string,
  reason?: string
) {
  const res = await fetch(`/api/claims/${claimId}/transition`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStatus, reason }),
  });

  if (res.status === 409) {
    // Concurrent modification - reload and retry
    throw new Error('Claim was modified. Please refresh.');
  }

  return res.json();
}
```

### Downloading Files

```typescript
async function downloadFile(claimId: string, fileId: string) {
  const res = await fetch(
    `/api/claims/${claimId}/files/${fileId}/download`,
    { credentials: 'include' }
  );

  const { downloadUrl, fileName } = await res.json();

  // Open in new tab or trigger download
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  link.click();
}
```

---

## Permission Checks

```typescript
function canEditClaim(user: User): boolean {
  return (
    user.permissions.includes('claims:edit') &&
    user.role.scopeType === 'UNLIMITED'
  );
}

function canCreateClaim(user: User): boolean {
  return user.permissions.includes('claims:create');
}

function canViewAudit(user: User): boolean {
  return (
    user.permissions.includes('claims:read') &&
    user.role.scopeType === 'UNLIMITED'
  );
}
```

---

## Scope Filtering Examples

```typescript
// CLIENT scope user listing claims
// Automatically filtered to their assigned clients
const claims = await fetch('/api/claims', { credentials: 'include' });

// SELF scope user
// Only sees claims where they are the affiliate
const claims = await fetch('/api/claims', { credentials: 'include' });

// Explicit client filter (validated against user's access)
const claims = await fetch(`/api/claims?clientId=${clientId}`, {
  credentials: 'include'
});
// Returns 403 if user doesn't have access to clientId
```
