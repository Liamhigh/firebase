import type { Contradiction } from "../core/types.js";
import { Phi3Legal } from "./models.js";

/**
 * Snapshot of real firewall state the chat is allowed to speak about.
 * The chat NEVER sees raw transactions or document text — only the same
 * aggregate facts the dashboard already exposes. This keeps the privacy
 * hard rule intact: nothing here can leak customer data.
 */
export interface ChatSnapshot {
  institution: string;
  jurisdiction: string;
  constitutionVersion: string;
  credits: { remaining: number; used: number };
  agents: Array<{ name: string; mission: string }>;
  evidence: Array<{ evidence_id: string; source_file: string; type: string }>;
  findings: {
    generated_at: string;
    document_count: number;
    atom_count: number;
    contradiction_count: number;
  } | null;
  contradictions: Contradiction[];
  rulesVersion: string | null;
}

export interface ChatReply {
  reply: string;
  intent: string;
  timestamp: string;
}

/**
 * Guardian case chat — the on-device engine communicator.
 *
 * Offline-first, deterministic, and Constitution-bound like every adapter in
 * this package (see models.ts): it answers questions about the CURRENT state
 * of the firewall — vault contents, findings, contradictions, seal credits,
 * deployed agents, applicable law — from a read-only snapshot. Swap `respond`
 * for a local Gemma/Phi/Mistral runtime without changing the API contract.
 * It never invents facts: every number in a reply comes from the snapshot.
 */
export class GuardianChat {
  private readonly phi3 = new Phi3Legal();

  respond(message: string, snap: ChatSnapshot): ChatReply {
    const q = message.toLowerCase();
    const [intent, reply] = this.route(q, snap);
    return { reply, intent, timestamp: new Date().toISOString() };
  }

  private route(q: string, snap: ChatSnapshot): [string, string] {
    if (/\b(hi|hello|hey|help|what can you)\b/.test(q)) {
      return ["help", this.helpText(snap)];
    }
    if (/\b(credits?|balance|seal count|how many seals)\b/.test(q)) {
      return [
        "credits",
        `Seal credits: ${snap.credits.remaining} remaining, ${snap.credits.used} used. ` +
          `Each sealed document or sealed findings bundle consumes one credit.`,
      ];
    }
    if (/\b(agents?|mistral|monitor(ing)? pool)\b/.test(q)) {
      const lines = snap.agents.map((a) => `- ${a.name}: ${a.mission}`);
      return [
        "agents",
        lines.length
          ? `${snap.agents.length} Constitution-bound investigator agent(s) deployed:\n${lines.join("\n")}`
          : "No investigator agents are deployed.",
      ];
    }
    if (/\b(vault|evidence|documents? (in|on file)|what.*ingested)\b/.test(q)) {
      const lines = snap.evidence
        .slice(0, 10)
        .map((e) => `- ${e.evidence_id} · ${e.source_file} (${e.type})`);
      return [
        "vault",
        snap.evidence.length
          ? `The evidence buffer holds ${snap.evidence.length} document(s):\n${lines.join("\n")}` +
            (snap.evidence.length > 10 ? `\n…and ${snap.evidence.length - 10} more.` : "")
          : "The evidence buffer is empty. Ingest documents on the Forensic Report page, then run a scan.",
      ];
    }
    if (/\b(contradictions?|findings?|scan results?|what did.*find)\b/.test(q)) {
      return ["findings", this.findingsText(snap)];
    }
    if (/\b(laws?|legal|statutes?|act|prosecut)\b/.test(q)) {
      const laws = this.phi3.applicableLaws("UNKNOWN", snap.jurisdiction);
      return [
        "law",
        `Applicable law for jurisdiction ${snap.jurisdiction}:\n` +
          laws.map((l) => `- ${l}`).join("\n"),
      ];
    }
    if (/\b(verify|verification|check.*seal|authentic)\b/.test(q)) {
      return [
        "verify",
        "Verification is centralised at the website hub: upload the sealed PDF at " +
          "https://www.verumglobal.foundation/verify.html. If the SHA-512 does not match, " +
          "the verdict is TAMPERED — DO NOT ACCEPT.",
      ];
    }
    if (/\b(privacy|customer data|leave|upload|send.*verum)\b/.test(q)) {
      return [
        "privacy",
        "Privacy hard rule: Verum Omnis receives commission invoices only — never customer data, " +
          "transactions, or sealed evidence. Everything you seal stays inside this institution's vault.",
      ];
    }
    if (/\b(constitution|directive|governance|article)\b/.test(q)) {
      return [
        "constitution",
        `This deployment runs under Constitution v${snap.constitutionVersion}. Findings cannot be ` +
          "suppressed, contradictions must be reported, and confirmed fraud is sealed with SHA-512. " +
          "The full text ships inside every sealed PDF.",
      ];
    }
    if (/\b(seal|how do i seal|sealing)\b/.test(q)) {
      return [
        "seal",
        "Use the Seal Document page: give the document a reference and title, paste or load its text, " +
          "and press SEAL DOCUMENT. You get a SHA-512 sealed PDF (one seal credit) that anyone can later " +
          "verify at the website hub.",
      ];
    }
    if (/\b(status|health|overview|summary|state)\b/.test(q)) {
      return ["status", this.statusText(snap)];
    }
    return ["status", this.statusText(snap)];
  }

  private statusText(snap: ChatSnapshot): string {
    const f = snap.findings;
    return [
      `Guardian Fraud Firewall — ${snap.institution} (${snap.jurisdiction}), Constitution v${snap.constitutionVersion}.`,
      `Seal credits: ${snap.credits.remaining} remaining (${snap.credits.used} used).`,
      `Fraud rules: ${snap.rulesVersion ? `signed package v${snap.rulesVersion}` : "bank baseline rules (no downloaded package)"}.`,
      `Evidence buffer: ${snap.evidence.length} document(s).`,
      f
        ? `Last scan (${f.generated_at}): ${f.document_count} document(s), ${f.atom_count} evidence atom(s), ${f.contradiction_count} contradiction(s).`
        : "No forensic scan has been run yet — use the Forensic Report page.",
      "Ask me about: credits, agents, vault, contradictions, law, sealing, verification, privacy, or the constitution.",
    ].join("\n");
  }

  private findingsText(snap: ChatSnapshot): string {
    const f = snap.findings;
    if (!f) {
      return "No findings on file. Run a forensic scan from the Forensic Report page first.";
    }
    const top = snap.contradictions.slice(0, 5).map(
      (c) =>
        `- ${c.contradiction_id} [${c.brain_source}] severity=${c.severity} confidence=${c.confidence}` +
        `${c.triple_ai_consensus.quorum ? " · QUORUM" : ""}`,
    );
    return [
      `Last scan (${f.generated_at}): ${f.document_count} document(s), ${f.atom_count} evidence atom(s), ` +
        `${f.contradiction_count} contradiction(s).`,
      ...(top.length ? ["Top contradictions:", ...top] : ["No contradictions were detected."]),
      "Findings are forensic indicators for human review — not determinations of fraud.",
    ].join("\n");
  }

  private helpText(snap: ChatSnapshot): string {
    return [
      `I am the Guardian case chat for ${snap.institution} — Constitution-bound and fully on-premise. ` +
        "I only report what this firewall actually knows; I never see customer transactions or document text.",
      "You can ask me about:",
      "- status — overall system state",
      "- credits — seal credit balance",
      "- agents — deployed investigator agents",
      "- vault / evidence — documents in the buffer",
      "- contradictions / findings — the last forensic scan",
      "- law — applicable statutes for this jurisdiction",
      "- sealing — how to seal a document",
      "- verification — how sealed documents are verified",
      "- privacy — what does and does not leave this institution",
    ].join("\n");
  }
}
