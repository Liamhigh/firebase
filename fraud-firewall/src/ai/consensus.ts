import type { DetectionSignal, VerificationVote } from "../core/types.js";
import {
  Gemma3Forensics,
  NineBrainEngine,
  Phi3Legal,
  type ModelContext,
} from "./models.js";

export interface TripleConsensusResult {
  quorum: boolean;
  votes: {
    gemma3: VerificationVote;
    phi3: VerificationVote;
    nine_brain: VerificationVote;
  };
  status: "CONFIRMED" | "HUMAN_REVIEW" | "REJECTED";
  summary: string;
}

/**
 * Triple-AI verification: Gemma 3 + Phi-3 + 9-Brain must concur.
 * Discrepancies → HUMAN_REVIEW.
 */
export class TripleAiConsensus {
  private readonly gemma3 = new Gemma3Forensics();
  private readonly phi3 = new Phi3Legal();
  private readonly nine = new NineBrainEngine();

  verify(
    ctx: ModelContext,
    proposed: DetectionSignal[],
  ): TripleConsensusResult {
    const votes = {
      gemma3: this.gemma3.verify(ctx, proposed),
      phi3: this.phi3.verify(ctx, proposed),
      nine_brain: this.nine.verify(ctx, proposed),
    };

    const concurs = Object.values(votes).filter((v) => v.vote === "CONCURS");
    const dissents = Object.values(votes).filter((v) => v.vote === "DISSENTS");
    const quorum = concurs.length === 3;

    let status: TripleConsensusResult["status"];
    let summary: string;
    if (quorum) {
      status = "CONFIRMED";
      summary = "All three verifiers CONCUR — alert confirmed";
    } else if (dissents.length >= 2 || proposed.length === 0) {
      status = "REJECTED";
      summary = "Insufficient concurrence — alert rejected";
    } else {
      status = "HUMAN_REVIEW";
      summary =
        "Verifier discrepancy — flagged for human review per Constitution";
    }

    return { quorum, votes, status, summary };
  }
}
