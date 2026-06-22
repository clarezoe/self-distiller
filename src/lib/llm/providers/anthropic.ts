import Anthropic from "@anthropic-ai/sdk";
import type {
  CompleteParams,
  CompleteResult,
  LlmAdapter,
  ResolvedCredential,
} from "../types";

// Anthropic adapter. Structured output via forced tool-use (the OpenAI-compatible
// json_schema shape does NOT cover Claude). Self-host Claude OAuth-via-SDK is a
// separate flag-gated path (not this adapter) — see research/claude-oauth-sdk.md.
export const anthropicAdapter: LlmAdapter = {
  provider: "anthropic",
  async complete<T = unknown>(
    params: CompleteParams,
    cred: ResolvedCredential,
  ): Promise<CompleteResult<T>> {
    const client = new Anthropic({
      apiKey: cred.apiKey,
      ...(cred.baseUrl ? { baseURL: cred.baseUrl } : {}),
    });

    const system = params.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const messages: Anthropic.MessageParam[] = params.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const maxTokens = params.maxTokens ?? 4096;

    if (params.schema) {
      const toolName = params.schema.name;
      const response = await client.messages.create({
        model: params.model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        messages,
        tools: [
          {
            name: toolName,
            description: `Return your answer by calling ${toolName} with structured fields.`,
            input_schema: params.schema.schema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: toolName },
      });

      const toolUse = response.content.find((b) => b.type === "tool_use");
      const parsed =
        toolUse && toolUse.type === "tool_use" ? (toolUse.input as T) : null;
      const text = parsed !== null ? JSON.stringify(parsed) : "";
      return { text, parsed, raw: response };
    }

    const response = await client.messages.create({
      model: params.model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      messages,
    });

    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return { text, parsed: null, raw: response };
  },
};
