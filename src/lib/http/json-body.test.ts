import { describe, expect, it } from "vitest";
import { readJsonBody, RequestBodyTooLargeError } from "./json-body";

describe("readJsonBody", () => {
  it("parses a body within the byte limit", async () => {
    const request = new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });
    await expect(readJsonBody(request, 100)).resolves.toEqual({ ok: true });
  });

  it("rejects a declared body larger than the limit", async () => {
    const request = new Request("http://test", {
      method: "POST",
      headers: { "content-length": "101" },
      body: "{}",
    });
    await expect(readJsonBody(request, 100)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("rejects a streamed body once it crosses the limit", async () => {
    const request = new Request("http://test", {
      method: "POST",
      body: "x".repeat(101),
    });
    await expect(readJsonBody(request, 100)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});
