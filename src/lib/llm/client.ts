import OpenAI from "openai";
import type { LlmCompleteOptions, LlmResponse } from "./types";
import { LlmError } from "./types";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "nex-agi/nex-n2.5-pro:free";

let client: OpenAI | null = null;

export function getLlmClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE") || apiKey.length < 20) {
    throw new LlmError(
      "OPENROUTER_API_KEY is not configured. Set it in .env.local.",
      500,
      false,
    );
  }
  client = new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    timeout: 300_000,
  });
  return client;
}

export function currentModel(): string {
  return process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
}

function stripCodeFences(input: string): string {
  const trimmed = input.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export async function llmComplete(options: LlmCompleteOptions): Promise<LlmResponse> {
  const openai = getLlmClient();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  if (options.messages) {
    messages.push(...options.messages);
  }
  if (options.user) {
    messages.push({ role: "user", content: options.user });
  }

  if (messages.length === 0) {
    throw new LlmError("llmComplete requires system, messages, or user input.", 500);
  }

  let attempt = 0;
  const maxAttempts = 3;

  for (;;) {
    try {
      const completion = await openai.chat.completions.create({
        model: options.model ?? currentModel(),
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 4096,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      });

      const content = completion.choices?.[0]?.message?.content ?? "";
      if (!completion.choices || completion.choices.length === 0) {
        throw new LlmError("OpenRouter returned no choices. Retrying.", 502, true);
      }
      return {
        content: options.json ? stripCodeFences(content) : content,
        model: completion.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
      };
    } catch (err) {
      const e = err as { status?: number; message?: string; code?: string };
      const status = e.status;
      const timeoutError =
        status === undefined &&
        (/(timed out|ETIMEDOUT|timeout)/i.test(e.message ?? "") || e.code === "ETIMEDOUT");
      const retryable =
        status === 429 || status === 408 || status === 529 || status === 502 || status === 503 || timeoutError;

      if (attempt >= maxAttempts - 1 || !retryable) {
        throw new LlmError(
          `OpenRouter request failed: ${e.message ?? "unknown error"}`,
          status,
          retryable,
        );
      }

      const waitMs = 1000 * 2 ** attempt + Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, waitMs));
      attempt += 1;
    }
  }
}

export async function llmJson<T>(
  options: Omit<LlmCompleteOptions, "json">,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const repairInstruction = attempt === 0
      ? ""
      : "\nPrevious output was invalid or incomplete. Return only a complete valid JSON object. Keep it concise and do not include markdown, commentary, or reasoning.";

    const res = await llmComplete({
      ...options,
      system: `${options.system ?? ""}${repairInstruction}`,
      json: true,
    });

    try {
      return JSON.parse(res.content) as T;
    } catch {
      lastError = new LlmError(
        `invalid JSON response (${res.content.length} characters)`,
        502,
        true,
      );
    }
  }

  throw new LlmError(
    `OpenRouter returned malformed JSON after 2 attempts: ${lastError?.message ?? "empty response"}`,
    502,
    true,
  );
}
