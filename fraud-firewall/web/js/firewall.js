import { $, toast, api, escapeHtml, row, refreshHealth, refreshCredits } from "./common.js";

/* ============================================================
   Verum Omnis — Guardian Fraud Firewall dashboard (banks)
   Transaction monitoring, triple-verification, sealing + invoice.
   ============================================================ */

const DEMO_TXNS = (() => {
  const base = Date.parse("2026-07-06T14:30:00Z");
  const txns = [];
  for (let i = 0; i < 25; i++) {
    txns.push({
      txn_id: `TXN-20260706-${884300 + i}`,
      account_id: "AC-7843",
      amount: i === 20 ? 1500000 : 12000 + i * 500,
      currency: "ZAR",
      timestamp: new Date(base + i * 2000).toISOString(),
      country: i === 22 ? "KP" : "ZA",
      channel: "EFT",
      counterparty: `CP-${(i % 9) + 1}`,
      metadata: i === 21 ? { internal_note: "urgent override" } : undefined,
    });
  }
  return txns;
})();

function showResult(result) {
  $("resultBlock").hidden = false;
  $("resultMessage").textContent = result.message || "";
  $("resultPre").textContent = JSON.stringify(result.alert || result, null, 2);

  const status = result.alert?.status || "NONE";
  $("statusValue").textContent = status;
  $("statusValue").className = "value " + (status === "CONFIRMED" ? "ok" : status === "REJECTED" ? "bad" : "");

  const quorum = result.alert?.verification?.quorum;
  $("quorumValue").textContent = quorum == null ? "—" : quorum ? "YES" : "NO";
  $("quorumValue").className = "value " + (quorum ? "ok" : quorum === false ? "bad" : "");

  const sealId = result.alert?.seal?.seal_id;
  const rowEl = $("downloadRow");
  const link = $("downloadSeal");
  if (sealId) {
    rowEl.hidden = false;
    link.href = `/v1/sealed/${sealId}`;
  } else {
    rowEl.hidden = true;
  }
}

async function runMonitor(transactions) {
  $("monitorBtn").disabled = true;
  $("runDemoBtn").disabled = true;
  try {
    const result = await api("/v1/monitor", {
      method: "POST",
      body: JSON.stringify({ transactions }),
    });
    showResult(result);
    await refreshCredits();
    await loadCommsLedger();
    toast(result.message || "Monitor complete", result.alert?.status === "CONFIRMED" ? "ok" : "err");
  } catch (err) {
    toast(err.message, "err");
  } finally {
    $("monitorBtn").disabled = false;
    $("runDemoBtn").disabled = false;
  }
}

function loadDemoIntoEditor() {
  $("txnInput").value = JSON.stringify(DEMO_TXNS, null, 2);
}

$("loadDemoBtn")?.addEventListener("click", () => {
  loadDemoIntoEditor();
  toast("Demo transactions loaded");
});
$("refreshCreditsBtn")?.addEventListener("click", () => refreshCredits());
$("runDemoBtn")?.addEventListener("click", async () => {
  loadDemoIntoEditor();
  await runMonitor(DEMO_TXNS);
});
$("monitorBtn")?.addEventListener("click", async () => {
  let transactions;
  try {
    const parsed = JSON.parse($("txnInput").value || "[]");
    transactions = Array.isArray(parsed) ? parsed : parsed.transactions;
    if (!Array.isArray(transactions)) throw new Error("Expected a JSON array");
  } catch (err) {
    toast(`Invalid JSON: ${err.message}`, "err");
    return;
  }
  await runMonitor(transactions);
});

/* ---------------- Communications ledger (anti-harassment) ---------------- */

async function loadCommsLedger() {
  const box = $("commsLedger");
  if (!box) return;
  try {
    const led = await api("/v1/comms/ledger");
    if (!led.total) {
      box.innerHTML = '<p class="sub">No outbound communications recorded yet.</p>';
      return;
    }
    const rows = led.recipients
      .map((r) => row(`${r.to} (${r.role})`, `${r.count} message(s)`))
      .join("");
    box.innerHTML = `<p class="sub">${led.total} outbound message(s) recorded in the vault.</p><div class="verify-grid">${rows}</div>`;
  } catch {
    box.innerHTML = '<p class="sub">Ledger unavailable.</p>';
  }
}

/* ---------------- Pricing & licensing ---------------- */

const AMOUNT_LABELS = {
  fraud_recovery: "Value prevented (ZAR)",
  ai_subscription: "AI company annual turnover (ZAR)",
  commercial: "Commercial engagement value (ZAR)",
  legal_services: "Explicit lawyer fee (optional — leave blank to benchmark)",
};

function fmtMoney(n, currency) {
  return `${currency} ${Number(n).toLocaleString("en-ZA", { maximumFractionDigits: 2 })}`;
}

async function loadPricing() {
  const host = $("priceStreams");
  if (!host) return;
  try {
    const p = await api("/v1/pricing");
    const cards = [
      { t: "Fraud recovery", c: p.streams.fraud_recovery, free: false },
      { t: "Legal services", c: p.streams.legal_services, free: false },
      { t: "AI subscription", c: p.streams.ai_subscription, free: false },
      { t: "Commercial", c: p.streams.commercial, free: false },
      { t: "Private individuals", c: p.free.individuals, free: true },
      { t: "SAPS", c: p.free.saps, free: true },
    ];
    host.innerHTML = cards
      .map(
        (x) =>
          `<div class="price-card ${x.free ? "free" : ""}"><div class="pc-title">${escapeHtml(x.t)}</div><p class="pc-copy">${escapeHtml(x.c)}</p></div>`,
      )
      .join("");
  } catch {
    /* best-effort */
  }
}

function syncQuoteForm() {
  const cat = $("quoteCategory")?.value;
  if (!cat) return;
  $("quoteAmountLabel").textContent = AMOUNT_LABELS[cat];
  const legal = cat === "legal_services";
  $("quoteJurisdictionField").hidden = !legal;
  $("quoteComplexityField").hidden = !legal;
}

async function runQuote() {
  const category = $("quoteCategory").value;
  const userType = $("quoteUserType").value;
  const amount = parseFloat($("quoteAmount").value) || 0;
  const payload = { category, user_type: userType };
  if (category === "fraud_recovery") payload.recovered_value = amount;
  else if (category === "ai_subscription") payload.annual_turnover = amount;
  else if (category === "commercial") payload.commercial_value = amount;
  else if (category === "legal_services") {
    if (amount > 0) payload.lawyer_fee = amount;
    payload.jurisdiction = $("quoteJurisdiction").value;
    payload.complexity = $("quoteComplexity").value;
  }
  $("quoteBtn").disabled = true;
  try {
    const q = await api("/v1/pricing/quote", { method: "POST", body: JSON.stringify(payload) });
    $("quoteResultBlock").hidden = false;
    const out = $("quoteAmountOut");
    if (q.billable) {
      out.className = "quote-amount";
      out.textContent = `${fmtMoney(q.charge, q.currency)}  (20% of ${fmtMoney(q.base_amount, q.currency)})`;
    } else {
      out.className = "quote-amount free";
      out.textContent = "FREE";
    }
    const rows = [
      row("Category", q.category),
      row("User type", q.user_type),
      row("Billable", q.billable ? "YES (20%)" : "NO — free"),
      row(q.base_label, fmtMoney(q.base_amount, q.currency)),
      row("Verum 20% share", fmtMoney(q.charge, q.currency)),
    ];
    if (q.benchmark) {
      rows.push(row("Lawyer benchmark", `${q.benchmark.hourly_rate}/hr x ${q.benchmark.hours}h x ${q.benchmark.entity_multiplier}`));
    }
    rows.push(row("Notes", q.notes.join(" ")));
    $("quoteGrid").innerHTML = rows.join("");
  } catch (err) {
    toast(err.message, "err");
  } finally {
    $("quoteBtn").disabled = false;
  }
}

$("quoteCategory")?.addEventListener("change", syncQuoteForm);
$("quoteBtn")?.addEventListener("click", runQuote);

/* ---------------- Boot ---------------- */
syncQuoteForm();
loadPricing();
loadDemoIntoEditor();
loadCommsLedger();
refreshHealth();
refreshCredits();
setInterval(refreshHealth, 15000);
