export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompleteOptions {
  system?: string;
  messages?: LlmMessage[];
  user?: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "LlmError";
  }
}