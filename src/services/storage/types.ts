export interface SignedUploadUrl {
  url: string;
  headers: Record<string, string>;
  key: string;
}

export interface UploadOptions {
  contentType: string;
  metadata?: Record<string, string>;
}

export interface SignedUrlOptions {
  expiresIn?: number; // seconds, default 900 (15 min)
}

export interface SignedUploadOptions extends SignedUrlOptions {
  contentType: string;
}
