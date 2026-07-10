import type { FirewallConfig } from "../core/types.js";

/**
 * Optional local-LLM adapter (Phase 5).
 *
 * Used ONLY for plain-English narrative assistance. The deterministic detection,
 * contradiction, timeline, offence, and sealing logic is never delegated to an
 * LLM — that must stay reproducible for court-admissible evidence (Constitution
 * v5.2.7). Any LLM failure/timeout falls back to the deterministic path.
 */

export interface LlmGenerateInput {
  system?: string;
  prompt: string;
}

export interface LlmProvider {
  readonly name: string;
  available(): Promise<boolean>;
  /** Return generated text, or null to signal "fall back to deterministic". */
  generate(input: LlmGenerateInput): Promise<string | null>;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Default: no LLM. Callers use their built-in deterministic output. */
export class DeterministicProvider implements LlmProvider {
  readonly name = "deterministic";
  async available(): Promise<boolean> {
    return false;
  }
  async generate(): Promise<string | null> {
    return null;
  }
}

/**
 * Talks to a local Ollama runtime (https://ollama.com) — e.g. a small model
 * like `phi3` or `gemma2:2b` running on the operator's laptop.
 */
export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs = 30000,
  ) {}

  async available(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/tags`, { method: "GET" }, 4000);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(input: LlmGenerateInput): Promise<string | null> {
    try {
      const res = await fetchWithTimeout(
        `${this.baseUrl}/api/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.model,
            prompt: input.prompt,
            system: input.system,
            stream: false,
            options: { temperature: 0 }, // low temperature for stability
          }),
        },
        this.timeoutMs,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { response?: unknown };
      return typeof data.response === "string" && data.response.trim()
        ? data.response.trim()
        : null;
    } catch {
      return null;
    }
  }
}

/** Build a provider from config. Deterministic unless mode=external + ollama configured. */
export function createLlmProvider(config: FirewallConfig): LlmProvider {
  const llm = config.ai?.llm;
  if (config.ai?.mode === "external" && llm?.provider === "ollama" && llm.base_url && llm.model) {
    return new OllamaProvider(llm.base_url, llm.model, llm.timeout_ms);
  }
  return new DeterministicProvider();
}
