import { beforeAll, describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret } from "./crypto";

beforeAll(() => {
  // 32-byte key as 64 hex chars.
  process.env.ENCRYPTION_KEY = "0".repeat(64);
});

describe("crypto", () => {
  it("round-trips a secret", () => {
    const plain = "sk-test-1234567890";
    const enc = encryptSecret(plain);
    expect(enc).not.toContain(plain);
    expect(enc.split(":")).toHaveLength(3);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });

  it("rejects tampered ciphertext (GCM auth tag)", () => {
    const enc = encryptSecret("secret");
    const [iv, tag, data] = enc.split(":");
    const flipped = data.slice(0, -1) + (data.endsWith("0") ? "1" : "0");
    expect(() => decryptSecret(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  it("rejects malformed ciphertext", () => {
    expect(() => decryptSecret("not-valid")).toThrow("Malformed ciphertext");
  });

  it("requires a 64-hex-char key", () => {
    const prev = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "tooshort";
    expect(() => encryptSecret("x")).toThrow();
    process.env.ENCRYPTION_KEY = prev;
  });
});
