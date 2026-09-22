import OpenAI from "openai";
import type { LlmCompleteOptions, LlmResponse } from "./types";
import { LlmError } from "./types";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "nex-agi/nex-n2.5-pro:free";
export const DEFAULT_FAST_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_VISION_MODEL = "openai/gpt-4o-mini";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_GROQ_VISION_MODEL = "qwen/qwen3.8-27b";

export const XAI_BASE_URL = "https://api.x.ai/v1";
export const DEFAULT_XAI_MODEL = "grok-4.6";

let client: OpenAI | null = null;

function isUsableKey(key: string | undefined): key is string {
  return Boolean(key && !key.includes("REPLACE") && key.length >= 20);
}

export function groqApiKey(): string | null {
  const key = process.env.GROQ_API_KEY;
  if (!isUsableKey(key)) return null;
  return key;
}

export function xaiApiKey(): string | null {
  const key = process.env.XAI_API_KEY;
  if (!isUsableKey(key)) return null;
  return key;
}

export function openRouterApiKeys(): string[] {
  const keys = [process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_KEY_2];
  return Array.from(new Set(keys.filter(isUsableKey)));
}

export function getLlmClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!isUsableKey(apiKey)) {
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

let groqClient: OpenAI | null = null;

export function getGroqClient(): OpenAI | null {
  const key = groqApiKey();
  if (!key) return null;
  if (groqClient) return groqClient;
  groqClient = new OpenAI({
    baseURL: GROQ_BASE_URL,
    apiKey: key,
    timeout: 300_000,
  });
  return groqClient;
}

let xaiClient: OpenAI | null = null;

export function getXaiClient(): OpenAI | null {
  const key = xaiApiKey();
  if (!key) return null;
  if (xaiClient) return xaiClient;
  xaiClient = new OpenAI({
    baseURL: XAI_BASE_URL,
    apiKey: key,
    timeout: 300_000,
  });
  return xaiClient;
}

export function currentModel(): string {
  return process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
}

export function currentFastModel(): string {
  return process.env.OPENROUTER_FAST_MODEL ?? DEFAULT_FAST_MODEL;
}

export function currentVisionModel(): string {
  return process.env.OPENROUTER_VISION_MODEL ?? process.env.OPENROUTER_FAST_MODEL ?? DEFAULT_VISION_MODEL;
}

export function currentGroqModel(): string {
  return process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;
}

export function currentGroqVisionModel(): string {
  return process.env.GROQ_VISION_MODEL ?? DEFAULT_GROQ_VISION_MODEL;
}

export function currentXaiModel(): string {
  return process.env.XAI_MODEL ?? DEFAULT_XAI_MODEL;
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
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  if (options.messages) {
    messages.push(...options.messages);
  }
  if (options.images && options.images.length > 0) {
    const textContent = options.user ?? "";
    const content: OpenAI.Chat.ChatCompletionContentPart[] = [];
    if (textContent) {
      content.push({ type: "text", text: textContent });
    }
    for (const image of options.images) {
      content.push({
        type: "image_url",
        image_url: { url: image.dataUrl, detail: "low" },
      });
    }
    messages.push({ role: "user", content });
  } else if (options.user) {
    messages.push({ role: "user", content: options.user });
  }

  if (messages.length === 0) {
    throw new LlmError("llmComplete requires system, messages, or user input.", 500);
  }

  const hasImages = options.images && options.images.length > 0;

  const baseParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: options.model ?? currentModel(),
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 4096,
    ...(options.json ? { response_format: { type: "json_object" } } : {}),
  };

  const attempts: Array<{
    label: string;
    run: () => Promise<LlmResponse>;
  }> = [];

  for (const key of openRouterApiKeys()) {
    const openai = new OpenAI({ baseURL: OPENROUTER_BASE_URL, apiKey: key, timeout: 300_000 });
    attempts.push({
      label: "OpenRouter",
      run: () => attemptCompletion(openai, { ...baseParams, model: options.model ?? currentModel() }, "OpenRouter"),
    });
  }

  const xai = getXaiClient();
  if (xai) {
    attempts.push({
      label: "Grok",
      run: () =>
        attemptCompletion(
          xai,
          { ...baseParams, model: currentXaiModel(), response_format: undefined },
          "Grok",
          true,
        ),
    });
  }

  const groq = getGroqClient();
  if (groq) {
    attempts.push({
      label: "Groq",
      run: () =>
        attemptCompletion(
          groq,
          {
            ...baseParams,
            model: hasImages ? currentGroqVisionModel() : currentGroqModel(),
            response_format: undefined,
          },
          "Groq",
          true,
        ),
    });
  }

  if (attempts.length === 0) {
    throw new LlmError(
      "No LLM provider is configured. Set OPENROUTER_API_KEY, GROQ_API_KEY, or XAI_API_KEY in .env.local.",
      500,
      false,
    );
  }

  const errors: Error[] = [];
  for (const attempt of attempts) {
    try {
      return await attempt.run();
    } catch (error) {
      errors.push(error as Error);
    }
  }

  throw new LlmError(
    `All LLM providers failed. ${errors.map((e) => `${attempts[errors.indexOf(e)]?.label ?? "provider"}: ${e.message}`).join(" | ")}`,
    502,
    false,
  );
}

async function attemptCompletion(
  openai: OpenAI,
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  providerName: string,
  noRetry = false,
): Promise<LlmResponse> {
  let attempt = 0;
  const maxAttempts = noRetry ? 1 : 3;

  for (;;) {
    try {
      const completion = await openai.chat.completions.create(params);

      const content = completion.choices?.[0]?.message?.content ?? "";
      if (!completion.choices || completion.choices.length === 0) {
        throw new LlmError(`${providerName} returned no choices. Retrying.`, 502, true);
      }
      if (!content.trim()) {
        throw new LlmError(`${providerName} returned an empty response. Retrying.`, 502, true);
      }
      return {
        content: params.response_format?.type === "json_object" ? stripCodeFences(content) : content,
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
      const emptyResponse = e instanceof LlmError && e.message.includes("empty response");

      const cap = noRetry ? 1 : emptyResponse ? 2 : maxAttempts;
      if (attempt >= cap - 1 || !retryable) {
        throw new LlmError(
          `${providerName} request failed: ${e.message ?? "unknown error"}`,
          status,
          retryable,
        );
      }

      const waitMs = (emptyResponse ? 2000 : 1000) * 2 ** attempt + Math.floor(Math.random() * 500);
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
    `LLM returned malformed JSON after 2 attempts: ${lastError?.message ?? "empty response"}`,
    502,
    true,
  );
}
