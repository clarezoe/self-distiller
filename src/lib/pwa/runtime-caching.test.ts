import { describe, expect, it } from "vitest";
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from "serwist";
import { runtimeCaching } from "./runtime-caching";

const ORIGIN = "https://distill.example";

function strategyFor(path: string, init?: { headers?: Record<string, string>; origin?: string }) {
  const url = new URL(path, init?.origin ?? ORIGIN);
  const request = new Request(url, { headers: init?.headers });
  const sameOrigin = url.origin === ORIGIN;
  const rule = runtimeCaching.find((r) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r.matcher as any)({ request, url, sameOrigin, event: undefined }),
  );
  expect(rule).toBeDefined();
  return rule!.handler;
}

describe("service worker runtime caching privacy", () => {
  it.each([
    "/",
    "/interview",
    "/self-model",
    "/login",
    "/api/projects",
    "/api/materials?projectId=p1",
    "/api/persona?format=json",
    "/api/auth/session",
    "/offline.html",
    "/sw.js",
    "/manifest.webmanifest",
  ])("%s is NetworkOnly (document / API)", (path) => {
    expect(strategyFor(path)).toBeInstanceOf(NetworkOnly);
  });

  it("RSC requests are NetworkOnly", () => {
    expect(strategyFor("/interview?_rsc=abc", { headers: { RSC: "1" } })).toBeInstanceOf(NetworkOnly);
    expect(strategyFor("/self-model?_rsc=abc")).toBeInstanceOf(NetworkOnly);
  });

  it("cross-origin requests are NetworkOnly", () => {
    expect(strategyFor("/_next/static/a.js", { origin: "https://cdn.other" })).toBeInstanceOf(NetworkOnly);
    expect(strategyFor("/icons/icon-192.png", { origin: "https://cdn.other" })).toBeInstanceOf(NetworkOnly);
  });

  it("only static build assets, fonts and icons are cached", () => {
    expect(strategyFor("/_next/static/chunks/app.js")).toBeInstanceOf(CacheFirst);
    expect(strategyFor("/_next/static/media/geist.woff2")).toBeInstanceOf(CacheFirst);
    expect(strategyFor("/icons/icon-192.png")).toBeInstanceOf(StaleWhileRevalidate);
  });

  it("an /icons/ path cannot smuggle a non-image response", () => {
    expect(strategyFor("/icons/../api/projects")).toBeInstanceOf(NetworkOnly);
    expect(strategyFor("/icons/data.json")).toBeInstanceOf(NetworkOnly);
  });
});
