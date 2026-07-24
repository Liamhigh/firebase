/**
 * G3 candidate registry — persistent store for the GHRP two-tier rule.
 *
 * Candidates raised by the G3 review pass are persisted in the vault findings
 * directory so they survive restarts and can be promoted (engine re-run or
 * human sign-off) or rejected (reason sealed with the record — never
 * deleted). Promotion has a real side effect: the candidate's opposing
 * proposition pair is written to the promoted-rules file, which the
 * deterministic ContradictionEngine consumes on the next extraction — so the
 * contradiction Gemma 3 caught becomes something the engine itself detects.
 */

import type { FirewallConfig } from "../core/types.js";
import { appendJsonl, findingsPath, readJson, writeJson } from "../storage/vault.js";
import {
  STATUS_CANDIDATE_PROMOTED,
  STATUS_CANDIDATE_REJECTED,
  STATUS_G3_CANDIDATE,
  type ContradictionRecord,
} from "../pipeline/findingsJsonEmitter.js";

/** An opposing phrase pair promoted from a G3 candidate into an engine rule. */
export interface PromotedPair {
  rule_id: string;
  first: string;
  second: string;
  promoted_at: string;
  method: string;
}

export class G3CandidateStore {
  constructor(private readonly config: FirewallConfig) {}

  private candidatesFile(): string {
    return findingsPath(this.config, "g3_candidates.json");
  }

  private promotedRulesFile(): string {
    return findingsPath(this.config, "g3_promoted_rules.json");
  }

  private auditFile(): string {
    return findingsPath(this.config, "g3_audit_log.jsonl");
  }

  list(): ContradictionRecord[] {
    return readJson<ContradictionRecord[]>(this.candidatesFile()) ?? [];
  }

  pending(): ContradictionRecord[] {
    return this.list().filter((c) => c.verification_status === STATUS_G3_CANDIDATE);
  }

  /**
   * Merge freshly raised candidates into the store. Records already present
   * keep their status — a promotion or rejection is never silently undone by
   * a re-scan raising the same candidate id.
   */
  record(records: ContradictionRecord[], now: string): void {
    if (!records.length) return;
    const existing = this.list();
    const byId = new Map(existing.map((c) => [c.contradiction_id, c]));
    for (const record of records) {
      if (byId.has(record.contradiction_id)) continue;
      byId.set(record.contradiction_id, record);
      appendJsonl(this.auditFile(), {
        action: "RAISED",
        candidate_id: record.contradiction_id,
        detail: record.type,
        utc: now,
      });
    }
    writeJson(this.candidatesFile(), [...byId.values()]);
  }

  /**
   * Promote a candidate to engine-verified after engine re-run or human
   * sign-off, and emit its proposition pair as a promoted engine rule.
   */
  promote(candidateId: string, method = "human_signoff", now = new Date().toISOString()): ContradictionRecord {
    const all = this.list();
    const idx = all.findIndex((c) => c.contradiction_id === candidateId);
    if (idx < 0) throw new Error(`Unknown candidate ${candidateId}`);
    if (all[idx].verification_status !== STATUS_G3_CANDIDATE) {
      throw new Error(`Candidate ${candidateId} is not pending (status: ${all[idx].verification_status})`);
    }
    const promoted: ContradictionRecord = {
      ...all[idx],
      verification_status: STATUS_CANDIDATE_PROMOTED,
    };
    all[idx] = promoted;
    writeJson(this.candidatesFile(), all);

    const pairs = this.promotedPairs();
    const ruleId = `G3_${candidateId}`;
    if (!pairs.some((p) => p.rule_id === ruleId)) {
      pairs.push({
        rule_id: ruleId,
        first: promoted.proposition_a_text.trim(),
        second: promoted.proposition_b_text.trim(),
        promoted_at: now,
        method,
      });
      writeJson(this.promotedRulesFile(), pairs);
    }
    appendJsonl(this.auditFile(), {
      action: "PROMOTED",
      candidate_id: candidateId,
      detail: method,
      utc: now,
    });
    return promoted;
  }

  /** Reject a candidate. Never deleted — the reason is sealed with it. */
  reject(candidateId: string, reason: string, now = new Date().toISOString()): ContradictionRecord {
    if (!reason.trim()) {
      throw new Error("Rejection requires a reason. The record of why is itself evidence.");
    }
    const all = this.list();
    const idx = all.findIndex((c) => c.contradiction_id === candidateId);
    if (idx < 0) throw new Error(`Unknown candidate ${candidateId}`);
    const rejected: ContradictionRecord = {
      ...all[idx],
      verification_status: STATUS_CANDIDATE_REJECTED,
      rejection_reason: reason,
    };
    all[idx] = rejected;
    writeJson(this.candidatesFile(), all);
    appendJsonl(this.auditFile(), {
      action: "REJECTED",
      candidate_id: candidateId,
      detail: reason,
      utc: now,
    });
    return rejected;
  }

  /** Rules consumable by the deterministic engine on the next extraction. */
  promotedPairs(): PromotedPair[] {
    return readJson<PromotedPair[]>(this.promotedRulesFile()) ?? [];
  }
}
