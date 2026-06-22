import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for credential secrets at rest. Stored as "iv:authTag:ciphertext" (hex).
// Key: ENCRYPTION_KEY = 32 bytes as 64 hex chars (openssl rand -hex 32).

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate: openssl rand -hex 32");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Malformed ciphertext");
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
