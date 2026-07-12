import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// ─── Storage Configuration ────────────────────────────────────────────────────

// Local disk root — in production this directory should be outside the
// web-served public folder, and ideally on a separate volume or mounted disk.
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage", "documents");

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "local"; // "local" | "s3" | "r2"

// ─── Ensure Storage Directory Exists ──────────────────────────────────────────
// Called once at server startup (wired in server.js) to guarantee the
// upload target directory is present before any request tries to write to it.

export const ensureStorageReady = async () => {
  try {
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    console.log(`Storage directory ready: ${STORAGE_ROOT}`);
  } catch (error) {
    console.error("Failed to create storage directory:", error);
    throw error;
  }
};

// ─── Generate a Safe Storage Key ──────────────────────────────────────────────
// Never trust the original filename for the actual storage path — it can
// contain path traversal sequences (../../etc/passwd), null bytes, or
// characters that break the filesystem. We generate a random key instead
// and keep the original filename only as metadata in MongoDB.
//
// Format: documents/{userId}/{uuid}.{extension}

export const generateStorageKey = (userId, fileExtension) => {
  const uniqueId = crypto.randomUUID();
  return `documents/${userId}/${uniqueId}.${fileExtension}`;
};

// ─── Compute SHA-256 Checksum ─────────────────────────────────────────────────
// Used for duplicate detection and integrity verification.

export const computeChecksum = (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

// ─── Resolve Absolute Path from Storage Key ───────────────────────────────────
// Validates that the resolved path stays within STORAGE_ROOT — a defence-in-depth
// check against path traversal even though generateStorageKey already
// produces safe keys. Never trust a storageKey read back from the database
// without re-validating it.

const resolveSafePath = (storageKey) => {
  const resolvedPath = path.resolve(STORAGE_ROOT, storageKey);
  const normalizedRoot = path.resolve(STORAGE_ROOT);

  if (!resolvedPath.startsWith(normalizedRoot + path.sep) && resolvedPath !== normalizedRoot) {
    throw new Error("Invalid storage key: path traversal detected");
  }

  return resolvedPath;
};

// ─── Save File to Storage ─────────────────────────────────────────────────────
// Writes the buffer to disk (local) or uploads to object storage (S3/R2 — stubbed).
// Returns the storageKey that should be persisted on the Document model.

export const saveFile = async ({ buffer, userId, fileExtension }) => {
  const storageKey = generateStorageKey(userId, fileExtension);

  if (STORAGE_PROVIDER === "local") {
    const absolutePath = resolveSafePath(storageKey);
    const dirPath = path.dirname(absolutePath);

    // Ensure the per-user subdirectory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Write with restrictive permissions — owner read/write only
    await fs.writeFile(absolutePath, buffer, { mode: 0o600 });

    return { storageKey, storageBucket: null, storageProvider: "local" };
  }

  if (STORAGE_PROVIDER === "s3" || STORAGE_PROVIDER === "r2") {
    // ── S3 / R2 implementation stub ──────────────────────────────────────────
    // Swap in @aws-sdk/client-s3 here when moving to production.
    // Kept as a clear extension point so the rest of the app never needs
    // to know which provider is active — only this function changes.
    //
    // Example shape:
    //
    // const client = new S3Client({ region: process.env.AWS_REGION });
    // await client.send(new PutObjectCommand({
    //   Bucket: process.env.S3_BUCKET,
    //   Key: storageKey,
    //   Body: buffer,
    //   ServerSideEncryption: "AES256",
    // }));
    //
    // return { storageKey, storageBucket: process.env.S3_BUCKET, storageProvider: STORAGE_PROVIDER };

    throw new Error(
      `Storage provider "${STORAGE_PROVIDER}" is not yet configured. ` +
      `Implement the S3/R2 client in fileStorage.js before enabling this provider.`
    );
  }

  throw new Error(`Unknown storage provider: ${STORAGE_PROVIDER}`);
};

// ─── Read File from Storage ───────────────────────────────────────────────────
// Used by the parsing worker and document download endpoint.

export const readFile = async (storageKey, storageProvider = "local") => {
  if (storageProvider === "local") {
    const absolutePath = resolveSafePath(storageKey);
    return fs.readFile(absolutePath);
  }

  if (storageProvider === "s3" || storageProvider === "r2") {
    throw new Error(
      `Storage provider "${storageProvider}" read is not yet configured.`
    );
  }

  throw new Error(`Unknown storage provider: ${storageProvider}`);
};

// ─── Delete File from Storage ─────────────────────────────────────────────────
// Called when a document is permanently purged (after the soft-delete
// grace period, or by an admin cleanup job).

export const deleteFile = async (storageKey, storageProvider = "local") => {
  if (storageProvider === "local") {
    const absolutePath = resolveSafePath(storageKey);

    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      // ENOENT means the file is already gone — not an error worth surfacing
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    return true;
  }

  if (storageProvider === "s3" || storageProvider === "r2") {
    throw new Error(
      `Storage provider "${storageProvider}" delete is not yet configured.`
    );
  }

  throw new Error(`Unknown storage provider: ${storageProvider}`);
};

// ─── Get File Size on Disk ────────────────────────────────────────────────────
// Sanity check used after writing — confirms the file actually landed
// correctly and matches the expected size before we mark the upload successful.

export const getStoredFileSize = async (storageKey, storageProvider = "local") => {
  if (storageProvider === "local") {
    const absolutePath = resolveSafePath(storageKey);
    const stats = await fs.stat(absolutePath);
    return stats.size;
  }

  throw new Error(`Size check not implemented for provider: ${storageProvider}`);
};
