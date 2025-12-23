# Storage

File storage service for Cloudflare R2 (S3-compatible).

## Setup

1. Add R2 credentials to your `.env`:

```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
```

2. Configure CORS on your R2 bucket (required for presigned URLs):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "AllowedMethods": ["GET", "HEAD", "PUT", "DELETE"],
    "AllowedHeaders": ["Content-Type", "x-amz-*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Quick start

```typescript
// From a feature handler (e.g., src/features/claims/handlers.ts)
import {
  upload,
  getSignedUploadUrl,
  getSignedDownloadUrl,
  getMimeType,
} from "../../services/storage/index.js";

// Server-side upload
await upload(`claims/${claimId}/document.pdf`, buffer, {
  contentType: "application/pdf",
});

// Generate presigned URL for client upload
const { url, headers, key } = await getSignedUploadUrl(
  `avatars/${userId}.jpg`,
  { contentType: "image/jpeg" },
);
// Client must PUT to `url` with `headers` exactly

// Generate presigned URL for client download
const downloadUrl = await getSignedDownloadUrl(`claims/${claimId}/document.pdf`);
```

## Structure

```
src/services/storage/
├── index.ts        # Public exports
├── types.ts        # SignedUploadUrl, UploadOptions, etc.
├── client.ts       # Lazy S3Client singleton
├── service.ts      # upload, download, delete, signed URLs
├── utils.ts        # getMimeType helper
└── README.md
```

## API

### `upload(key, data, options)`

Upload a file to storage (server-side).

| Parameter           | Type               | Description              |
|---------------------|--------------------|--------------------------|
| `key`               | `string`           | Storage key/path         |
| `data`              | `Buffer \| Readable` | File contents          |
| `options.contentType` | `string`         | MIME type                |
| `options.metadata`  | `object?`          | Custom metadata          |

### `downloadStream(key)`

Download a file as a Node.js Readable stream.

```typescript
const stream = await downloadStream("claims/123/doc.pdf");
stream.pipe(res); // Pipe to HTTP response
```

**Note:** Node.js only. Use for large files to avoid memory issues.

### `downloadBuffer(key)`

Download a file as a Buffer (convenience method).

```typescript
const buffer = await downloadBuffer("avatars/user.jpg");
```

**Caution:** Only use for small files - loads entire file into memory.

### `deleteFile(key)`

Delete a file from storage.

```typescript
await deleteFile("claims/123/doc.pdf");
```

**Note:** Does not throw if file doesn't exist (R2/S3 behavior).

### `getSignedUploadUrl(key, options)`

Generate a presigned URL for direct browser upload.

```typescript
const { url, headers, key } = await getSignedUploadUrl(
  `uploads/${userId}/${filename}`,
  { contentType: "image/jpeg", expiresIn: 300 },
);
```

| Parameter             | Type      | Default | Description              |
|-----------------------|-----------|---------|--------------------------|
| `options.contentType` | `string`  | -       | Required MIME type       |
| `options.expiresIn`   | `number?` | 900     | URL expiry in seconds    |

**Returns:** `{ url, headers, key }`

**Important:** Client must send `headers` exactly when uploading.

### `getSignedDownloadUrl(key, options?)`

Generate a presigned URL for direct browser download.

```typescript
const url = await getSignedDownloadUrl("claims/123/doc.pdf", {
  expiresIn: 3600,
});
```

| Parameter           | Type      | Default | Description              |
|---------------------|-----------|---------|--------------------------|
| `options.expiresIn` | `number?` | 900     | URL expiry in seconds    |

### `getMimeType(filename)`

Get MIME type from filename extension.

```typescript
getMimeType("document.pdf");  // "application/pdf"
getMimeType("photo.jpg");     // "image/jpeg"
getMimeType("unknown.xyz");   // "application/octet-stream"
```

## Error handling

Storage operations throw on failure. Handle missing files by checking the HTTP status:

```typescript
import { downloadBuffer } from "../../services/storage/index.js";

try {
  const buffer = await downloadBuffer(key);
} catch (err) {
  // AWS SDK v3: check $metadata for HTTP status
  const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  if (status === 404) {
    throw new NotFoundError("File not found");
  }
  throw err;
}
```

## Client-side upload example

```typescript
// Backend endpoint returns presigned URL
const { url, headers } = await fetch("/api/upload-url").then(r => r.json());

// Client uploads directly to R2
await fetch(url, {
  method: "PUT",
  headers,
  body: file,
});
```

## Environment variables

| Variable              | Required | Description                     |
|-----------------------|----------|---------------------------------|
| `R2_ACCOUNT_ID`       | Yes*     | Cloudflare account ID           |
| `R2_ACCESS_KEY_ID`    | Yes*     | R2 API access key               |
| `R2_SECRET_ACCESS_KEY`| Yes*     | R2 API secret key               |
| `R2_BUCKET_NAME`      | Yes*     | R2 bucket name                  |
| `R2_PUBLIC_URL`       | No       | Public URL for bucket (if any)  |

*Required when storage functions are called. Service throws if not configured.

## Design notes

- **Lazy client:** S3Client only instantiated on first use.
- **Errors propagate:** Unlike audit logging, storage errors should be handled.
- **Key-based:** Caller controls key structure (e.g., `users/{id}/avatar.jpg`).
- **No validation:** Content type is metadata only; validate at app boundary.
- **Node.js only:** `downloadStream()` returns Node Readable stream.
