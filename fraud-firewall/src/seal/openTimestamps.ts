// VO-DSS-1.2 step 3 — OpenTimestamps submission.
// Posts the raw SHA-256 digest bytes to public calendar servers; the first
// server to answer with a non-empty proof wins. Identical server list and
// semantics to the web submitToOTS().

export const OTS_CALENDARS = [
  "https://a.pool.opentimestamps.org/digest",
  "https://b.pool.opentimestamps.org/digest",
  "https://a.pool.eternitywall.com/digest",
] as const;

export interface OtsSuccess {
  success: true;
  calendar: string;
  proof: Uint8Array;
}

export interface OtsFailure {
  success: false;
  error: string;
}

export type OtsResult = OtsSuccess | OtsFailure;

export interface OtsOptions {
  calendars?: readonly string[];
  timeoutMs?: number;
  /** Injectable for tests/offline environments. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Submit a SHA-256 hex digest to the OpenTimestamps calendars.
 * Never throws — a network failure degrades to { success: false } so the
 * seal still completes and the hash can be re-anchored later.
 */
export async function submitToOTS(sha256HexValue: string, options: OtsOptions = {}): Promise<OtsResult> {
  const { hexToBytes } = await import("./sealHasher.js");
  const hashBytes = hexToBytes(sha256HexValue);
  const calendars = options.calendars ?? OTS_CALENDARS;
  const timeoutMs = options.timeoutMs ?? 15000;
  const doFetch = options.fetchImpl ?? fetch;

  for (const url of calendars) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      let res: Response;
      try {
        res = await doFetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/vnd.opentimestamps.v1",
          },
          body: hashBytes as unknown as BodyInit,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength > 0) return { success: true, calendar: url, proof: buf };
      }
    } catch {
      // Calendar unreachable — try the next one.
    }
  }
  return { success: false, error: "All calendar servers failed — hash recorded for retry" };
}
