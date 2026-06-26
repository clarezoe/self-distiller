"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const btnCls =
  "rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900";
const btnSecondary =
  "rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

type ParticipantOption = {
  name: string;
  email?: string;
  count: number;
  key: string;
};

type PreviewItem = {
  spaceName: string | null;
  turnCount: number;
  materialCount: number;
  dateRange: { from?: string; to?: string };
};

type ParseResult = {
  participants: ParticipantOption[];
  conversationCount: number;
  materialCount: number;
  preview: PreviewItem[];
};

// One uploaded messages.json file: its text + a derived space label.
type ChatFile = { content: string; spaceName?: string };

export function GoogleChatImportClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const t = useTranslations("googleChat");
  const tCommon = useTranslations("common");
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [ownerKey, setOwnerKey] = useState<string>("");
  const [busy, setBusy] = useState<null | "parse" | "commit">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setError(null);
    setDone(null);
    setParseResult(null);
    const read: ChatFile[] = [];
    for (const file of Array.from(list)) {
      const content = await file.text();
      // Use the file name as a best-effort space label.
      read.push({ content, spaceName: file.name.replace(/\.json$/i, "") });
    }
    setFiles(read);
  }

  async function parse() {
    setError(null);
    setDone(null);
    if (files.length === 0) {
      setError(t("chooseFilesFirst"));
      return;
    }
    setBusy("parse");
    try {
      const res = await fetch("/api/import/google-chat/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, files }),
      });
      if (!res.ok) throw new Error(await readError(res, t("errFailedParse")));
      const result = (await res.json()) as ParseResult;
      if (result.conversationCount === 0) {
        setError(t("noConversations"));
        setParseResult(null);
        return;
      }
      setParseResult(result);
      // Pre-select the most frequent participant as a best-guess "me".
      setOwnerKey(result.participants[0]?.key ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("somethingWrong"));
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    setError(null);
    setDone(null);
    if (!ownerKey) {
      setError(t("pickParticipant"));
      return;
    }
    setBusy("commit");
    try {
      const res = await fetch("/api/import/google-chat/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, files, ownerKey }),
      });
      if (!res.ok) throw new Error(await readError(res, t("errFailedCreate")));
      const result = (await res.json()) as { created: number; skipped: number };
      const skipNote =
        result.skipped > 0
          ? t("skipNote", { count: result.skipped, plural: result.skipped === 1 ? "" : "s" })
          : "";
      setDone(
        t("createdMaterials", {
          count: result.created,
          plural: result.created === 1 ? "" : "s",
          skipNote,
        }),
      );
      setParseResult(null);
      setFiles([]);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("somethingWrong"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div>
        <h2 className="font-medium">{t("title")}</h2>
        <p className="text-sm text-neutral-500">
          {t.rich("description", { code: (chunks) => <code className="text-xs">{chunks}</code> })}
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-500">{t("selectFiles")}</span>
        <input
          type="file"
          accept=".json,application/json"
          multiple
          onChange={handleFiles}
          className="block w-full text-sm"
        />
      </label>

      {files.length > 0 && !parseResult ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">{t("filesReady", { count: files.length })}</span>
          <button className={btnCls} onClick={parse} disabled={busy !== null}>
            {busy === "parse" ? t("parsing") : t("parse")}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
      ) : null}
      {done ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40">{done}</p>
      ) : null}

      {parseResult ? (
        <div className="space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-500">
            {t("foundConversations", {
              conversations: parseResult.conversationCount,
              materials: parseResult.materialCount,
            })}
          </p>
          <div className="space-y-1.5">
            {parseResult.participants.map((p) => (
              <label
                key={p.key}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  ownerKey === p.key
                    ? "border-neutral-900 dark:border-white"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                <input
                  type="radio"
                  name="owner"
                  checked={ownerKey === p.key}
                  onChange={() => setOwnerKey(p.key)}
                />
                <span className="font-medium">{p.name}</span>
                {p.email ? <span className="text-xs text-neutral-400">{p.email}</span> : null}
                <span className="ml-auto text-xs text-neutral-400">{t("messagesCount", { count: p.count })}</span>
              </label>
            ))}
          </div>

          {parseResult.preview.length > 0 ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-neutral-500">{t("previewConversations")}</summary>
              <ul className="mt-2 space-y-1 text-xs text-neutral-500">
                {parseResult.preview.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-600 dark:text-neutral-300">
                      {c.spaceName ?? t("unnamed")}
                    </span>
                    <span>{t("turns", { count: c.turnCount })}</span>
                    <span>
                      {t("materials", { count: c.materialCount, plural: c.materialCount === 1 ? "" : "s" })}
                    </span>
                    {c.dateRange.from ? <span>{t("fromDate", { date: c.dateRange.from })}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex items-center gap-3">
            <button className={btnSecondary} onClick={commit} disabled={busy !== null || !ownerKey}>
              {busy === "commit" ? t("creating") : t("confirmCreate")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string") return data.error;
    if (data?.error) return JSON.stringify(data.error);
  } catch {
    // ignore
  }
  return fallback;
}
