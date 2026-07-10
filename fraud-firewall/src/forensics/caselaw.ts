import type { CaseSearch, Entity } from "../core/types.js";

/**
 * Court-case / litigation lookup over the entities of interest.
 *
 * Real court databases (esp. SA/UAE) require an authenticated provider, so the
 * default is OFFLINE: it prepares the search queries and lists the parties to
 * check, and the report includes that section. A live provider can be plugged
 * in later (config `caselaw.provider`) without changing the report contract.
 */

export interface CaseLawProvider {
  readonly name: string;
  search(entities: Entity[]): Promise<CaseSearch>;
}

/** Offline default: prepares queries but performs no network lookup. */
export class OfflineCaseLawProvider implements CaseLawProvider {
  readonly name = "offline";
  async search(entities: Entity[]): Promise<CaseSearch> {
    const parties = entities.filter((e) => e.mentions >= 2).slice(0, 20);
    const queries = parties.map(
      (p) => `${p.name} ${p.type === "organization" ? "litigation OR court case" : "court case OR judgment"}`,
    );
    return {
      provider: this.name,
      status: "OFFLINE",
      queries,
      results: parties.map((p) => ({
        entity: p.name,
        note: "Offline: configure a court-case provider to fetch related cases.",
      })),
      note:
        "External court-case search is offline. Configure caselaw.provider to " +
        "query real court databases for these parties, then re-run the scan.",
    };
  }
}

export function createCaseLawProvider(): CaseLawProvider {
  // Only the offline provider ships today; a live provider is a drop-in here.
  return new OfflineCaseLawProvider();
}
