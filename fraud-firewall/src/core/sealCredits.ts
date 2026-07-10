import { sha512, stableStringify, makeLogId } from "./crypto.js";
import type { FirewallConfig, SealCreditLedger } from "./types.js";
import { readJson, writeJson } from "../storage/vault.js";

export class SealCreditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SealCreditError";
  }
}

export class SealCreditLedgerService {
  constructor(private readonly config: FirewallConfig) {}

  load(): SealCreditLedger {
    const existing = readJson<SealCreditLedger>(this.config.storage.ledger_file);
    if (existing) return existing;
    return this.bootstrap();
  }

  private bootstrap(): SealCreditLedger {
    const now = new Date().toISOString();
    const initial = this.config.seal_credits.initial_balance;
    const ledger: SealCreditLedger = {
      ledger_id: `SL-${this.config.institution.code}`,
      institution: this.config.institution.name,
      license_tier: "Enterprise",
      credits: {
        purchased: initial,
        used: 0,
        remaining: initial,
        expired: 0,
      },
      purchase_history:
        initial > 0
          ? [
              {
                date: now.slice(0, 10),
                amount: initial,
                payment_ref: "BOOTSTRAP",
                verified_by: "Gemma3",
              },
            ]
          : [],
      usage_log: [],
      ai_maintained: true,
      last_updated: now,
      sha512: "",
    };
    ledger.sha512 = sha512(stableStringify({ ...ledger, sha512: "" }));
    writeJson(this.config.storage.ledger_file, ledger);
    return ledger;
  }

  canSeal(): boolean {
    return this.load().credits.remaining > 0;
  }

  remaining(): number {
    return this.load().credits.remaining;
  }

  addCredits(
    amount: number,
    paymentRef: string,
    costZar?: number,
    verifiedBy = "Gemma3",
  ): SealCreditLedger {
    if (amount <= 0) throw new SealCreditError("Credit amount must be positive");
    if (!paymentRef.trim()) {
      throw new SealCreditError("Payment proof reference required");
    }
    const ledger = this.load();
    ledger.credits.purchased += amount;
    ledger.credits.remaining += amount;
    ledger.purchase_history.push({
      date: new Date().toISOString().slice(0, 10),
      amount,
      cost_zar: costZar,
      payment_ref: paymentRef,
      verified_by: verifiedBy,
    });
    ledger.last_updated = new Date().toISOString();
    ledger.sha512 = sha512(stableStringify({ ...ledger, sha512: "" }));
    writeJson(this.config.storage.ledger_file, ledger);
    return ledger;
  }

  consumeSeal(params: {
    sealId: string;
    documentReference: string;
    documentSha512: string;
    aiVerifier?: string;
  }): SealCreditLedger {
    const ledger = this.load();
    if (ledger.credits.remaining <= 0) {
      throw new SealCreditError("No seal credits remaining");
    }
    const before = ledger.credits.remaining;
    ledger.credits.remaining -= 1;
    ledger.credits.used += 1;
    const now = new Date();
    ledger.usage_log.push({
      log_id: makeLogId("SL", now, ledger.usage_log.length + 1),
      seal_id: params.sealId,
      document_reference: params.documentReference,
      credits_before: before,
      credits_after: ledger.credits.remaining,
      ai_verifier: params.aiVerifier ?? "Gemma3",
      timestamp: now.toISOString(),
      sha512: params.documentSha512,
    });
    ledger.last_updated = now.toISOString();
    ledger.sha512 = sha512(stableStringify({ ...ledger, sha512: "" }));
    writeJson(this.config.storage.ledger_file, ledger);
    return ledger;
  }

  isLowBalance(): boolean {
    return (
      this.remaining() <= this.config.seal_credits.low_balance_threshold
    );
  }
}
