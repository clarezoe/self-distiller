// Local Google Chat Takeout pre-processor — NO LLM, NO network. Splits messages
// by speaker so you can keep only your own words before anything touches an LLM.
//
// Usage:
//   pnpm tsx scripts/extract-chat.ts <inDir> <outDir> [--me <key>]
//     <inDir>  folder of Google Chat messages.json files (e.g. ~/Downloads/gchat-messages)
//     <outDir> where to write results (e.g. ~/Downloads/gchat-processed)
//     --me     participant key to treat as "you" (from _speakers.tsv). Omit → guesses
//              the most-frequent speaker across all files (usually the account owner).
//
// Writes (LOCAL files only; the terminal prints counts only, no names/text):
//   <outDir>/_speakers.tsv          name \t email \t totalCount \t key  (find yourself here)
//   <outDir>/MY_MESSAGES.txt        only your lines, all conversations (your style corpus)
//   <outDir>/by-conversation/*.txt  full labeled transcript (me: / <name>:) per conversation
//   <outDir>/by-speaker/*.txt       every speaker's lines, separately

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { parseGoogleChat } from "../src/lib/import/google-chat";

function safe(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "unknown";
}

const [, , inDir, outDir, ...rest] = process.argv;
if (!inDir || !outDir) {
  console.error("Usage: pnpm tsx scripts/extract-chat.ts <inDir> <outDir> [--me <key>]");
  process.exit(1);
}
const meFlag = rest.indexOf("--me");
const meOverride = meFlag >= 0 ? rest[meFlag + 1] : undefined;

const jsonFiles = readdirSync(inDir).filter((f) => f.toLowerCase().endsWith(".json"));
const files = jsonFiles.map((f) => ({
  content: readFileSync(join(inDir, f), "utf8"),
  spaceName: basename(f, ".json"),
}));

const parsed = parseGoogleChat(files);

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, "by-conversation"), { recursive: true });
mkdirSync(join(outDir, "by-speaker"), { recursive: true });

// _speakers.tsv (local only)
const speakersTsv = ["name\temail\tcount\tkey"]
  .concat(parsed.participants.map((p) => `${p.name}\t${p.email ?? ""}\t${p.count}\t${p.key}`))
  .join("\n");
writeFileSync(join(outDir, "_speakers.tsv"), speakersTsv + "\n");

const ownerKey = meOverride ?? parsed.participants[0]?.key;

// Accumulators
const myLines: string[] = [];
const bySpeaker = new Map<string, string[]>();
let myCount = 0;
let totalTurns = 0;

for (const conv of parsed.conversations) {
  totalTurns += conv.turns.length;
  const labeled: string[] = [`# ${conv.spaceName ?? "conversation"}`];
  const mineHere: string[] = [];
  for (const t of conv.turns) {
    const who = t.key === ownerKey ? "me" : t.sender;
    labeled.push(`${who}: ${t.text}`);
    if (t.key === ownerKey) {
      mineHere.push(t.text);
      myCount++;
    }
    const arr = bySpeaker.get(t.key) ?? [];
    arr.push(t.text);
    bySpeaker.set(t.key, arr);
  }
  writeFileSync(join(outDir, "by-conversation", `${safe(conv.spaceName ?? "conversation")}.txt`), labeled.join("\n") + "\n");
  if (mineHere.length) {
    myLines.push(`# ${conv.spaceName ?? "conversation"}`, ...mineHere, "");
  }
}

writeFileSync(join(outDir, "MY_MESSAGES.txt"), myLines.join("\n") + "\n");

for (const [key, lines] of bySpeaker) {
  writeFileSync(join(outDir, "by-speaker", `${safe(key)}.txt`), lines.join("\n") + "\n");
}

// Terminal: counts only — no names, emails, or message text.
console.log(JSON.stringify({
  files: jsonFiles.length,
  conversations: parsed.conversations.length,
  participants: parsed.participants.length,
  totalTurns,
  ownerKeyIsEmail: ownerKey?.startsWith("email:") ?? false,
  myMessageCount: myCount,
  outDir,
}, null, 2));
