import OpenAI from "openai";
import type {
  CompleteParams,
  CompleteResult,
  LlmAdapter,
  ResolvedCredential,
} from "../types";

// Covers OpenAI official, OpenRouter, and local OpenAI-compatible servers (Ollama/vLLM).
// Structured output via response_format json_schema.
export const openAiCompatibleAdapter: LlmAdapter = {
  provider: "openai_compatible",
  async complete<T = unknown>(
    params: CompleteParams,
    cred: ResolvedCredential,
  ): Promise<CompleteResult<T>> {
    const client = new OpenAI({ apiKey: cred.apiKey, baseURL: cred.baseUrl });

    const response = await client.chat.completions.create({
      model: params.model,
      messages: params.messages,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.maxTokens !== undefined ? { max_tokens: params.maxTokens } : {}),
      ...(params.schema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: params.schema.name,
                schema: params.schema.schema,
                strict: true,
              },
            },
          }
        : {}),
    });

    const text = response.choices[0]?.message?.content ?? "";
    let parsed: T | null = null;
    if (params.schema && text) {
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        parsed = null;
      }
    }
    return { text, parsed, raw: response };
  },
};
