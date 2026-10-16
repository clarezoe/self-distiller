"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getRelationshipChoice,
  setRelationshipChoice,
  type RelationshipChoice,
} from "@/lib/import/relationship-choices";

const btnCls =
  "min-h-[44px] rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900";
const btnSecondary =
  "min-h-[44px] rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

type ParticipantOption = {
  name: string;
  email?: string;
  count: number;
  key: string;
};

type RelationshipOption = { id: string; name: string };

type ConversationItem = {
  index: number;
  spaceName: string | null;
  title: string | null;
  participantKeys: string[];
  turnCount: number;
  materialCount: number;
  dateRange: { from?: string; to?: string };
};

type ParseResult = {
  participants: ParticipantOption[];
  conversationCount: number;
  materialCount: number;
  conversations: ConversationItem[];
};

// One uploaded messages.json file: its text + a derived space label.
type ChatFile = { content: string; spaceName?: string; groupInfo?: string };

// Relationship choice: "" = not set, "new" = new name, otherwise an existing context id.
const NOT_SET: RelationshipChoice = { value: "", newName: "" };

const selectCls =
  "min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950";

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

export function GoogleChatImportClient({
  projectId,
  relationships,
}: {
  projectId: string;
  relationships: RelationshipOption[];
}) {
  const router = useRouter();
  const t = useTranslations("googleChat");
  const tCommon = useTranslations("common");
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [choices, setChoices] = useState<Record<string, RelationshipChoice>>({});
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
    const all = Array.from(list);
    const rel = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
    // Takeout folders: pair each messages.json with the group_info.json beside it.
    const infoByDir = new Map<string, File>();
    for (const f of all) {
      if (f.name.toLowerCase() === "group_info.json") infoByDir.set(dirOf(rel(f)), f);
    }
    for (const file of all) {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".json") || lower === "group_info.json") continue;
      const path = rel(file);
      if (path && lower !== "messages.json") continue; // folder mode: skip unrelated json
      const dir = dirOf(path);
      const content = await file.text();
      // A loose file has no trustworthy sibling relationship; only pair metadata
      // when webkitRelativePath proves both files came from the same folder.
      const info = dir ? infoByDir.get(dir) : undefined;
      const spaceName = dir ? dir.split("/").pop() : file.name.replace(/\.json$/i, "");
      read.push({ content, spaceName, groupInfo: info ? await info.text() : undefined });
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
      setChoices({});
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("somethingWrong"));
    } finally {
      setBusy(null);
    }
  }

  function partnerKeysOf(c: ConversationItem): string[] {
    return c.participantKeys.filter((k) => k !== ownerKey);
  }

  // Only one-to-one conversations share a choice. Group conversations stay
  // independent because their members can have different relationships to the owner.
  function choiceOf(c: ConversationItem): RelationshipChoice {
    return getRelationshipChoice(choices, c, ownerKey, NOT_SET);
  }

  function partnerNames(c: ConversationItem): string {
    const byKey = new Map((parseResult?.participants ?? []).map((p) => [p.key, p.name]));
    const names = partnerKeysOf(c).map((k) => byKey.get(k) ?? k);
    return names.length > 0 ? names.join(", ") : (c.title ?? c.spaceName ?? t("unnamed"));
  }

  function setChoice(c: ConversationItem, choice: RelationshipChoice) {
    setChoices((prev) => setRelationshipChoice(prev, c, ownerKey, choice));
  }

  function buildAssignments() {
    const out: { conversationIndex: number; contextIds?: string[]; newRelationshipName?: string }[] = [];
    for (const c of parseResult?.conversations ?? []) {
      const ch = choiceOf(c);
      if (ch.value === "new") {
        if (ch.newName.trim()) out.push({ conversationIndex: c.index, newRelationshipName: ch.newName.trim() });
      } else if (ch.value) {
        out.push({ conversationIndex: c.index, contextIds: [ch.value] });
      }
    }
    return out;
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
        body: JSON.stringify({ projectId, files, ownerKey, assignments: buildAssignments() }),
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
          className="block w-full text-base"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-neutral-500">{t("selectFolder")}</span>
        <input
          type="file"
          // @ts-expect-error non-standard attribute, supported by all major browsers
          webkitdirectory=""
          multiple
          onChange={handleFiles}
          className="block w-full text-base"
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

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("relationshipsTitle")}</p>
            <p className="text-xs text-neutral-500">{t("relationshipsHelp")}</p>
            <ul className="space-y-2">
              {parseResult.conversations.map((c) => {
                const ch = choiceOf(c);
                return (
                  <li key={c.index} className="space-y-2 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                    <div className="break-words font-medium">{partnerNames(c)}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                      <span>{t("turns", { count: c.turnCount })}</span>
                      <span>
                        {t("materials", { count: c.materialCount, plural: c.materialCount === 1 ? "" : "s" })}
                      </span>
                      {c.dateRange.from || c.dateRange.to ? (
                        <span>
                          {t("dateRange", {
                            from: c.dateRange.from ?? c.dateRange.to ?? "",
                            to: c.dateRange.to ?? c.dateRange.from ?? "",
                          })}
                        </span>
                      ) : null}
                    </div>
                    <select
                      className={selectCls}
                      value={ch.value}
                      aria-label={t("relationshipLabel")}
                      onChange={(e) => setChoice(c, { value: e.target.value, newName: ch.newName })}
                    >
                      <option value="">{t("notSet")}</option>
                      {relationships.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                      <option value="new">{t("newRelationship")}</option>
                    </select>
                    {ch.value === "new" ? (
                      <input
                        className={selectCls}
                        value={ch.newName}
                        placeholder={t("newRelationshipPlaceholder")}
                        onChange={(e) => setChoice(c, { value: "new", newName: e.target.value })}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex items-center gap-3">
            <button className={`${btnSecondary} min-h-[44px]`} onClick={commit} disabled={busy !== null || !ownerKey}>
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
