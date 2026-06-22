import { openAiCompatibleAdapter } from "./providers/openai-compatible";
import { anthropicAdapter } from "./providers/anthropic";
import type { AgentRole, LlmAdapter, Provider } from "./types";

export const ADAPTERS: Record<Provider, LlmAdapter> = {
  openai_compatible: openAiCompatibleAdapter,
  anthropic: anthropicAdapter,
};

// Hard fallbacks when the user has set no default model. Latest Claude ids per project rules.
export const DEFAULT_MODELS: Record<Provider, string> = {
  openai_compatible: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6",
};

export type LlmSettingsLike = {
  defaultProvider?: string | null;
  defaultModel?: string | null;
  agentOverrides?: unknown;
} | null;

// Pure resolution per D6: providerOverride → user default → fallback;
// modelOverride → per-agent override → user default → fallback.
export function resolveProviderModel(
  settings: LlmSettingsLike,
  args: { agentRole: AgentRole; providerOverride?: Provider; modelOverride?: string },
): { provider: Provider; model: string } {
  const provider: Provider =
    args.providerOverride ??
    (settings?.defaultProvider as Provider | undefined) ??
    "openai_compatible";
  const overrides = (settings?.agentOverrides ?? {}) as Record<string, string>;
  const model =
    args.modelOverride ??
    overrides[args.agentRole] ??
    settings?.defaultModel ??
    DEFAULT_MODELS[provider];
  return { provider, model };
}

export function getAdapter(provider: Provider): LlmAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`Unsupported provider "${provider}".`);
  return adapter;
}
