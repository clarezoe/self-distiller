// Provider-agnostic LLM layer (D2). One interface, per-provider adapters.

export type Provider = "openai_compatible" | "anthropic";

// chatgpt_subscription is a disabled placeholder in the UI (research: ToS / no reusable client).
export const PROVIDER_OPTIONS: { value: Provider | "chatgpt_subscription"; label: string; disabled?: boolean }[] = [
  { value: "openai_compatible", label: "OpenAI-compatible (OpenAI / OpenRouter / local)" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "chatgpt_subscription", label: "ChatGPT subscription (unavailable — use OpenAI-compatible)", disabled: true },
];

export const AGENT_ROLES = [
  "import_analyzer",
  "self_model_generator",
  "interview_planner",
  "interview_extractor",
  "blind_comparator",
  "persona_router",
  "output_generator",
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type JsonSchema = Record<string, unknown>;

export type CompleteParams = {
  messages: LlmMessage[];
  model: string;
  // When provided, the adapter forces structured JSON output matching this schema.
  // `strict` (default true) maps to OpenAI Structured Outputs strict mode, whose
  // schema subset forbids open-ended maps (additionalProperties:true), optional
  // properties, and keywords like minItems. Set `strict: false` for schemas with
  // user-defined dynamic keys (e.g. the Self Model's context maps, PRD §23.8).
  schema?: { name: string; schema: JsonSchema; strict?: boolean };
  temperature?: number;
  maxTokens?: number;
};

export type ResolvedCredential = {
  provider: Provider;
  apiKey: string;
  baseUrl?: string;
};

export type CompleteResult<T = unknown> = {
  text: string;
  parsed: T | null;
  raw: unknown;
};

export interface LlmAdapter {
  readonly provider: Provider;
  complete<T = unknown>(
    params: CompleteParams,
    cred: ResolvedCredential,
  ): Promise<CompleteResult<T>>;
}
