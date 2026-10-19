import { describe, expect, it, vi } from "vitest";
import { run, parseJsonl, parseArgs } from "./distill-import.mjs";

const SECRET_CONTENT = "TOP-SECRET-CONTENT-12345";
const TOKEN = "tok_super_secret_value";

function harness(file: string, fetchImpl = vi.fn()) {
  const lines: string[] = [];
  const push = (s: string) => lines.push(s);
  return {
    lines,
    fetchImpl,
    go: (argv: string[], env: Record<string, string> = { DISTILL_URL: "http://x", DISTILL_IMPORT_TOKEN: TOKEN }) =>
      run({ argv, env, fetchImpl, readFileImpl: async () => file, out: push, err: push }),
  };
}

const good = (c = SECRET_CONTENT, extra = {}) => JSON.stringify({ sourceType: "social_post", content: c, language: "en", ...extra });

describe("distill-import CLI", () => {
  it("--dry-run makes no network call and prints counts per sourceType/language", async () => {
    const h = harness([good(), good("b"), JSON.stringify({ sourceType: "email", content: "c", language: "zh" })].join("\n"));
    const code = await h.go(["--project", "p", "f.jsonl", "--dry-run"], {});
    expect(code).toBe(0);
    expect(h.fetchImpl).not.toHaveBeenCalled();
    const out = h.lines.join("\n");
    expect(out).toContain("social_post: 2");
    expect(out).toContain("email: 1");
    expect(out).toContain("en: 2");
    expect(out).toContain("zh: 1");
  });

  it("dry-run exits non-zero and reports line numbers for bad lines", async () => {
    const h = harness([good(), "{not json", JSON.stringify({ sourceType: "nope", content: "x" })].join("\n"));
    const code = await h.go(["--project", "p", "f", "--dry-run"]);
    expect(code).toBe(1);
    const out = h.lines.join("\n");
    expect(out).toContain("line 2: invalid JSON");
    expect(out).toContain("line 3: invalid sourceType");
  });

  it("prints no content and no token, including malicious server errors", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        created: 1,
        skipped: 0,
        ids: ["a"],
        errors: [{ index: 1, error: `${SECRET_CONTENT} ${TOKEN}` }],
      }),
    }));
    const h = harness([good(), good("other " + SECRET_CONTENT)].join("\n"), fetchImpl);
    const code = await h.go(["--project", "p", "f"]);
    expect(code).toBe(1);
    const out = h.lines.join("\n");
    expect(out).toContain("created: 1");
    expect(out).toContain("failed: 1");
    expect(out).toContain("line 2:");
    expect(out).not.toContain(SECRET_CONTENT);
    expect(out).not.toContain(TOKEN);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, { headers: Record<string, string>; redirect: string }];
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.redirect).toBe("error");
  });

  it("rejects malformed success responses without leaking server data", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ created: null, leaked: SECRET_CONTENT }),
    }));
    const h = harness(good(), fetchImpl);
    const code = await h.go(["--project", "p", "f"]);
    expect(code).toBe(1);
    expect(h.lines.join("\n")).toContain("invalid server response");
    expect(h.lines.join("\n")).not.toContain(SECRET_CONTENT);
  });

  it("rejects unknown options without echoing the option value", async () => {
    const h = harness(good());
    const code = await h.go(["--project", "p", "--secret=" + TOKEN, "f"]);
    expect(code).toBe(2);
    expect(h.lines.join("\n")).toContain("unknown option");
    expect(h.lines.join("\n")).not.toContain(TOKEN);
  });

  it("rejects blank context names locally", async () => {
    const h = harness(good("a", { contextNames: [""] }));
    const code = await h.go(["--project", "p", "f", "--dry-run"]);
    expect(code).toBe(1);
    expect(h.lines.join("\n")).toContain("contextNames");
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });

  it("redacts a secret used as a language count label", async () => {
    const h = harness(good("a", { language: TOKEN }));
    const code = await h.go(["--project", "p", "f", "--dry-run"]);
    expect(code).toBe(0);
    expect(h.lines.join("\n")).not.toContain(TOKEN);
    expect(h.lines.join("\n")).toContain("(redacted): 1");
  });

  it("batches requests and maps item indexes back to file line numbers", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ created: 0, skipped: 2, ids: [], errors: [] }) }));
    const h = harness([good("a"), "", good("b"), good("c")].join("\n"), fetchImpl);
    const code = await h.go(["--project", "p", "f", "--batch-size", "2"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(code).toBe(0);
    expect(h.lines.join("\n")).toContain("skipped: 4");
  });

  it("a 401 fails every line without leaking the token", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    const h = harness([good("a"), good("b")].join("\n"), fetchImpl);
    const code = await h.go(["--project", "p", "f", "--batch-size", "1"]);
    expect(code).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const out = h.lines.join("\n");
    expect(out).toContain("failed: 2");
    expect(out).not.toContain(TOKEN);
  });

  it("requires env for a real run and rejects bad args", async () => {
    const h = harness(good());
    expect(await h.go(["--project", "p", "f"], {})).toBe(2);
    expect(h.fetchImpl).not.toHaveBeenCalled();
    expect(() => parseArgs(["--batch-size", "0"])).toThrow();
    expect(parseJsonl(`${good()}\n\n`).items).toHaveLength(1);
  });

  it("help warns about boilerplate", async () => {
    const h = harness("");
    await h.go(["--help"]);
    expect(h.lines.join("\n")).toMatch(/boilerplate/);
  });
});
