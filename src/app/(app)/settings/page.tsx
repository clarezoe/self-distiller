import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PROVIDER_OPTIONS, runAgent, type Provider } from "@/lib/llm";
import {
  getSettings,
  listCredentials,
  updateSettings,
  upsertCredential,
} from "@/lib/services/settings";
import { SubmitButton } from "@/components/submit-button";

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950";
const btnCls =
  "rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900";

const REAL_PROVIDERS = PROVIDER_OPTIONS.filter((p) => !p.disabled);

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string; saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const userId = user.id;

  const { test, saved } = await searchParams;
  const [settings, creds] = await Promise.all([
    getSettings(userId),
    listCredentials(userId),
  ]);

  async function saveSettings(formData: FormData) {
    "use server";
    const defaultProvider = String(formData.get("defaultProvider") ?? "openai_compatible");
    const defaultModel = String(formData.get("defaultModel") ?? "").trim();
    await updateSettings(userId, { defaultProvider, defaultModel: defaultModel || null });
    revalidatePath("/settings");
    redirect("/settings?saved=1");
  }

  async function saveCredential(formData: FormData) {
    "use server";
    const provider = String(formData.get("provider") ?? "") as Provider;
    const apiKey = String(formData.get("apiKey") ?? "").trim();
    const baseUrl = String(formData.get("baseUrl") ?? "").trim();
    if (!apiKey || (provider !== "openai_compatible" && provider !== "anthropic")) return;
    await upsertCredential(userId, { provider, apiKey, baseUrl: baseUrl || undefined });
    revalidatePath("/settings");
    redirect("/settings?saved=1");
  }

  async function testConnection() {
    "use server";
    let message: string;
    try {
      const res = await runAgent<{ ok: boolean }>({
        userId,
        agentRole: "output_generator",
        messages: [
          { role: "user", content: 'Return a JSON object exactly: {"ok": true}.' },
        ],
        maxTokens: 100,
        schema: {
          name: "ping",
          schema: {
            type: "object",
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
            additionalProperties: false,
          },
        },
      });
      message = res.parsed?.ok ? "ok" : "Call succeeded but output was not schema-valid";
    } catch (e) {
      message = e instanceof Error ? e.message : "Unknown error";
    }
    redirect(`/settings?test=${encodeURIComponent(message)}`);
  }

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-neutral-500">LLM provider, model, and credentials.</p>
      </header>

      {saved ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40">
          Saved.
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">Default provider &amp; model</h2>
        <form action={saveSettings} className="space-y-3">
          <select name="defaultProvider" className={inputCls} defaultValue={settings?.defaultProvider ?? "openai_compatible"}>
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.value} value={p.value} disabled={p.disabled}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            name="defaultModel"
            placeholder="Default model (e.g. gpt-4o-mini, claude-sonnet-4-6)"
            defaultValue={settings?.defaultModel ?? ""}
            className={inputCls}
          />
          <SubmitButton className={btnCls} pendingText="Saving…">Save settings</SubmitButton>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">Credentials</h2>
        {creds.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {creds.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">{c.provider}</span>
                <span className="text-neutral-500">{c.baseUrl ?? "default endpoint"}</span>
                <span className="text-xs text-green-600">key stored (encrypted)</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No credentials yet.</p>
        )}

        <form action={saveCredential} className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <select name="provider" className={inputCls} defaultValue="openai_compatible">
            {REAL_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <input name="baseUrl" placeholder="Base URL (OpenAI-compatible only, optional)" className={inputCls} />
          <input name="apiKey" type="password" placeholder="API key" className={inputCls} required autoComplete="off" />
          <SubmitButton className={btnCls} pendingText="Saving…">Save credential</SubmitButton>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">Test connection</h2>
        <p className="text-sm text-neutral-500">
          Makes one real structured LLM call using your default provider and a saved credential.
        </p>
        <form action={testConnection}>
          <SubmitButton className={btnCls} pendingText="Testing… (a few seconds)">Run test</SubmitButton>
        </form>
        {test ? (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              test === "ok"
                ? "bg-green-50 text-green-700 dark:bg-green-950/40"
                : "bg-red-50 text-red-700 dark:bg-red-950/40"
            }`}
          >
            {test === "ok"
              ? "✓ Success — structured LLM call returned valid JSON."
              : `✗ Failed: ${test}`}
          </p>
        ) : null}
      </section>
    </div>
  );
}
