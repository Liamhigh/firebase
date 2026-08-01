/**
 * Local llama.cpp server client for the Gemma 3 hybrid pipeline.
 *
 * Talks to a llama.cpp `llama-server` instance running ON THE SAME HOST
 * (default http://127.0.0.1:8080) — no cloud calls, so the offline-first
 * constitution constraint holds: the model weights and inference never leave
 * the machine. Configure via config `ai.llama_server_url`, or the
 * VO_LLAMA_URL environment variable; when neither is set the client is
 * disabled and every consumer falls back to the deterministic pipeline.
 */

export interface LlamaGenerateOptions {
  maxTokens?: number;
  temperature?: number;
}

/** Minimal generation surface consumers depend on (tests stub this). */
export interface LlamaLike {
  readonly model: string;
  enabled(): boolean;
  available(): Promise<boolean>;
  generate(prompt: string, opts?: LlamaGenerateOptions): Promise<string | null>;
}

export class LlamaCppClient implements LlamaLike {
  readonly baseUrl: string | null;
  readonly model: string;
  private readonly timeoutMs: number;

  constructor(opts: { baseUrl?: string | null; model?: string; timeoutMs?: number } = {}) {
    this.baseUrl =
      (opts.baseUrl ?? process.env.VO_LLAMA_URL ?? null)?.replace(/\/+$/, "") ?? null;
    this.model = opts.model ?? "gemma-3-4b-it";
    this.timeoutMs = opts.timeoutMs ?? 120_000;
  }

  enabled(): boolean {
    return this.baseUrl !== null;
  }

  /** Cheap health probe so a configured-but-down server degrades gracefully. */
  async available(): Promise<boolean> {
    if (!this.baseUrl) return false;
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(Math.min(this.timeoutMs, 5_000)),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * One bounded completion against llama.cpp's native /completion endpoint.
   * Returns null on any failure — callers must fall back deterministically.
   */
  async generate(prompt: string, opts: LlamaGenerateOptions = {}): Promise<string | null> {
    if (!this.baseUrl) return null;
    try {
      const res = await fetch(`${this.baseUrl}/completion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          n_predict: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.2,
          stream: false,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { content?: unknown };
      const content = typeof data.content === "string" ? data.content.trim() : "";
      return content.length ? content : null;
    } catch {
      return null;
    }
  }
}
