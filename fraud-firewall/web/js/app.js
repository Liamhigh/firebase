const $ = (id) => document.getElementById(id);

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

function toast(message, kind = "ok") {
  const el = $("toast");
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.remove("show");
  }, 3200);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || res.statusText || "Request failed");
  }
  return data;
}

async function refreshHealth() {
  const pill = $("healthPill");
  try {
    const health = await api("/health");
    pill.className = "pill";
    pill.innerHTML = `<span class="dot"></span> ${health.institution || "Online"}`;
  } catch {
    pill.className = "pill err";
    pill.innerHTML = `<span class="dot"></span> Offline`;
  }
}

async function refreshCredits() {
  try {
    const ledger = await api("/v1/credits");
    $("creditValue").textContent = String(ledger.credits.remaining);
    if (ledger.credits.remaining <= 50) {
      $("creditValue").classList.add("bad");
    } else {
      $("creditValue").classList.remove("bad");
      $("creditValue").classList.add("ok");
    }
  } catch (err) {
    $("creditValue").textContent = "—";
    toast(err.message, "err");
  }
}

function showResult(result) {
  const block = $("resultBlock");
  block.hidden = false;
  $("resultMessage").textContent = result.message || "";
  $("resultPre").textContent = JSON.stringify(result.alert || result, null, 2);

  const status = result.alert?.status || "NONE";
  $("statusValue").textContent = status;
  $("statusValue").className =
    "value " + (status === "CONFIRMED" ? "ok" : status === "REJECTED" ? "bad" : "");

  const quorum = result.alert?.verification?.quorum;
  $("quorumValue").textContent = quorum == null ? "—" : quorum ? "YES" : "NO";
  $("quorumValue").className = "value " + (quorum ? "ok" : quorum === false ? "bad" : "");

  const sealId = result.alert?.seal?.seal_id;
  const row = $("downloadRow");
  const link = $("downloadSeal");
  if (sealId) {
    row.hidden = false;
    link.href = `/v1/sealed/${sealId}`;
  } else {
    row.hidden = true;
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

$("loadDemoBtn").addEventListener("click", () => {
  loadDemoIntoEditor();
  toast("Demo transactions loaded");
});

$("refreshCreditsBtn").addEventListener("click", () => refreshCredits());

$("runDemoBtn").addEventListener("click", async () => {
  loadDemoIntoEditor();
  await runMonitor(DEMO_TXNS);
});

$("monitorBtn").addEventListener("click", async () => {
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

/* ---------------- Evidence extraction ---------------- */

const DEMO_DOCS = [
  {
    evidence_id: "DOC001",
    type: "document",
    source_file: "witness_statement.txt",
    jurisdiction: "ZA-KZN",
    pages: [
      {
        page: 1,
        text:
          "On 9 March 2025, Marius Nortje stated that the Kevin's Export deal fell through completely.\n" +
          "He repeated this position in a follow-up call the same afternoon.\n" +
          "Later correspondence on 6 April 2025 confirmed that the Kevin's Export deal proceeded as planned.",
      },
    ],
  },
  {
    evidence_id: "DOC002",
    type: "document",
    source_file: "invoice_ledger.txt",
    jurisdiction: "ZA-KZN",
    pages: [
      {
        page: 1,
        text:
          "The shipment invoice was recorded in the ledger as ZAR 250000 for the quarter.\n" +
          "The same shipment invoice was later reported to the external auditors as ZAR 480000.",
      },
    ],
  },
  {
    evidence_id: "DOC003",
    type: "document",
    source_file: "board_minutes.txt",
    jurisdiction: "ZA-KZN",
    pages: [
      {
        page: 1,
        text:
          "The board meeting was held on 12 February 2025 according to the signed minutes.\n" +
          "The board meeting occurred on 18 February 2025 per the attendance register.",
      },
    ],
  },
];

function loadDemoDocsIntoEditor() {
  $("docInput").value = JSON.stringify(DEMO_DOCS, null, 2);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderFindings(result) {
  const findings = result.findings || result;
  const contradictions = findings.contradictions || [];
  $("extractResultBlock").hidden = false;
  $("docCountValue").textContent = String(findings.document_count ?? "—");
  $("atomCountValue").textContent = String(findings.atom_count ?? "—");
  const contraEl = $("contraCountValue");
  contraEl.textContent = String(findings.contradiction_count ?? contradictions.length);
  contraEl.className = "value " + (contradictions.length ? "bad" : "ok");

  const tl = findings.timeline?.length ?? 0;
  const off = findings.offences?.length ?? 0;
  const bf = findings.brain_findings?.length ?? 0;
  const ent = findings.entities?.length ?? 0;
  const consensus = findings.consensus;
  const consensusStr = consensus
    ? ` · consensus ${consensus.verdict} (${consensus.count} brains)`
    : "";
  $("extractMessage").textContent =
    `${findings.atom_count} evidence atom(s) · ${contradictions.length} contradiction(s) · ` +
    `${tl} timeline event(s) · ${off} offence(s) · ${bf} brain finding(s) · ${ent} part(y/ies)${consensusStr}.`;

  $("contraList").innerHTML = contradictions
    .map((c) => {
      const sev = c.severity;
      const quorum = c.triple_ai_consensus?.quorum;
      return `
      <div class="contra-card sev-${sev}">
        <div class="contra-head">
          <span class="contra-id">${escapeHtml(c.contradiction_id)}</span>
          <span class="badge">${escapeHtml(c.brain_source)}</span>
          <span class="badge sev-${sev}">${escapeHtml(sev)}</span>
          <span class="badge">${escapeHtml(c.confidence)}</span>
          ${c.respondent ? `<span class="badge">${escapeHtml(c.respondent)}</span>` : ""}
          ${quorum ? '<span class="badge quorum">QUORUM ✓</span>' : ""}
        </div>
        <p class="claim"><span class="tag">A</span>${escapeHtml(c.claim_a.text)}
          <span class="src">${escapeHtml(c.claim_a.source)} · ${c.claim_a.sha512.slice(0, 16)}…</span>
        </p>
        <p class="claim"><span class="tag">B</span>${escapeHtml(c.claim_b.text)}
          <span class="src">${escapeHtml(c.claim_b.source)} · ${c.claim_b.sha512.slice(0, 16)}…</span>
        </p>
        ${c.applicable_law?.length ? `<p class="contra-law">${escapeHtml(c.applicable_law.join(" · "))}</p>` : ""}
      </div>`;
    })
    .join("");

  $("extractPre").textContent = JSON.stringify(findings, null, 2);

  const row = $("extractDownloadRow");
  const link = $("downloadFindingsSeal");
  if (result.seal?.seal_id) {
    row.hidden = false;
    link.href = `/v1/sealed/${result.seal.seal_id}`;
  } else {
    row.hidden = true;
  }
}

async function runExtract(documents, seal) {
  $("extractBtn").disabled = true;
  try {
    const result = await api("/v1/extract", {
      method: "POST",
      body: JSON.stringify({ documents, seal }),
    });
    renderFindings(result);
    if (seal) await refreshCredits();
    const count = result.findings?.contradiction_count ?? 0;
    toast(
      count ? `${count} contradiction(s) detected` : "Extraction complete — no contradictions",
      count ? "err" : "ok",
    );
  } catch (err) {
    toast(err.message, "err");
  } finally {
    $("extractBtn").disabled = false;
  }
}

let uploadedCount = 0;

function getGeo() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      () => resolve(null),
      { timeout: 6000, maximumAge: 600000 },
    );
  });
}

async function uploadEvidenceFiles(files) {
  const status = $("uploadStatus");
  status.hidden = false;
  const names = [];
  // Capture upload location once (approximate on laptops; permission-based).
  const coords = await getGeo();
  const geoQs = coords
    ? `&lat=${coords.latitude}&lon=${coords.longitude}&acc=${coords.accuracy ?? ""}`
    : "";
  for (const file of files) {
    status.textContent = `Uploading ${file.name}…`;
    try {
      const buf = await file.arrayBuffer();
      const rec = await api(`/v1/evidence/upload?filename=${encodeURIComponent(file.name)}${geoQs}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buf,
      });
      uploadedCount += 1;
      names.push(`${rec.source_file || file.name} (${rec.page_count} pg)`);
    } catch (err) {
      toast(`Upload failed for ${file.name}: ${err.message}`, "err");
    }
  }
  status.textContent = `Ingested ${uploadedCount} file(s): ${names.join(", ")}. Click "Extract & Detect" to analyse.`;
  toast(`Ingested ${names.length} file(s)`, "ok");
}

$("evidenceFiles").addEventListener("change", (e) => {
  const files = e.target.files;
  if (files && files.length) uploadEvidenceFiles([...files]);
});

$("clearEvidenceBtn").addEventListener("click", async () => {
  try {
    await api("/v1/evidence/reset", { method: "POST" });
    uploadedCount = 0;
    $("evidenceFiles").value = "";
    $("uploadStatus").hidden = true;
    toast("Uploaded evidence cleared");
  } catch (err) {
    toast(err.message, "err");
  }
});

$("loadDemoDocsBtn").addEventListener("click", () => {
  loadDemoDocsIntoEditor();
  toast("Demo evidence loaded");
});

$("extractBtn").addEventListener("click", async () => {
  const raw = $("docInput").value.trim();
  // Empty editor → analyse the uploaded (buffered) evidence on the server.
  if (!raw) {
    if (uploadedCount === 0) {
      toast("Upload a file or paste documents first", "err");
      return;
    }
    await runExtract(undefined, $("sealFindingsChk").checked);
    return;
  }
  let documents;
  try {
    const parsed = JSON.parse(raw);
    documents = Array.isArray(parsed) ? parsed : parsed.documents;
    if (!Array.isArray(documents)) throw new Error("Expected a JSON array of documents");
  } catch (err) {
    toast(`Invalid JSON: ${err.message}`, "err");
    return;
  }
  await runExtract(documents, $("sealFindingsChk").checked);
});

/* ---------------- Seal verification ---------------- */

async function sha512Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-512", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const VERIFY_BANNER = {
  VERIFIED: { cls: "verified", text: "VERIFIED — sealed & anchored" },
  SEAL_FOUND_PENDING_CHAIN: { cls: "pending", text: "SEAL VALID — blockchain pending" },
  TAMPERED: { cls: "tampered", text: "TAMPERED — hash mismatch" },
  NOT_FOUND: { cls: "notfound", text: "NOT FOUND — no such seal" },
  INDETERMINATE: { cls: "pending", text: "SEAL FOUND — supply the PDF to verify" },
};

function row(k, v) {
  return `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div>`;
}

function renderVerification(res) {
  $("verifyResultBlock").hidden = false;
  const banner = VERIFY_BANNER[res.result] || { cls: "notfound", text: res.result };
  const bEl = $("verifyBanner");
  bEl.className = "verify-banner " + banner.cls;
  bEl.textContent = banner.text;
  $("verifyMessage").textContent = res.message || "";

  const bc = res.blockchain || {};
  const rows = [
    row("Seal ID", res.seal_id || "—"),
    row("Integrity", res.integrity === null ? "—" : res.integrity ? "SHA-512 MATCH" : "MISMATCH"),
    row("Computed SHA-512", res.computed_sha512 || "—"),
    row("Anchored SHA-512", res.expected_sha512 || "—"),
    row("Blockchain", `${bc.provider || "OpenTimestamps"} · ${bc.status || "—"}` + (bc.confirmations != null ? ` (${bc.confirmations} conf)` : "")),
  ];
  if (bc.block_height) rows.push(row("Bitcoin block", String(bc.block_height)));
  $("verifyGrid").innerHTML = rows.join("");
}

async function runVerify() {
  const sealId = $("verifySealId").value.trim();
  const file = $("verifyFile").files?.[0];
  if (!sealId && !file) {
    toast("Select a sealed PDF or enter a seal ID", "err");
    return;
  }
  $("verifyBtn").disabled = true;
  try {
    let sha512;
    if (file) {
      sha512 = await sha512Hex(await file.arrayBuffer());
    }
    const res = await api("/v1/verify", {
      method: "POST",
      body: JSON.stringify({ seal_id: sealId || undefined, sha512 }),
    });
    renderVerification(res);
    const ok = res.result === "VERIFIED" || res.result === "SEAL_FOUND_PENDING_CHAIN";
    toast(res.result.replace(/_/g, " "), ok ? "ok" : "err");
  } catch (err) {
    // A 404 from the API still returns a JSON body; surface it if present.
    toast(err.message, "err");
  } finally {
    $("verifyBtn").disabled = false;
  }
}

$("verifyBtn").addEventListener("click", runVerify);

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
    $("priceStreams").innerHTML = cards
      .map(
        (x) =>
          `<div class="price-card ${x.free ? "free" : ""}"><div class="pc-title">${escapeHtml(x.t)}</div><p class="pc-copy">${escapeHtml(x.c)}</p></div>`,
      )
      .join("");
  } catch {
    /* pricing is best-effort */
  }
}

function syncQuoteForm() {
  const cat = $("quoteCategory").value;
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

$("quoteCategory").addEventListener("change", syncQuoteForm);
$("quoteBtn").addEventListener("click", runQuote);
syncQuoteForm();
loadPricing();

/* ---------------- AI assist ---------------- */

async function runAiSummary() {
  $("aiBtn").disabled = true;
  try {
    const prompt = $("aiPrompt").value.trim();
    const res = await api("/v1/ai/summary", {
      method: "POST",
      body: JSON.stringify({ prompt: prompt || undefined, use_findings: true }),
    });
    $("aiResultBlock").hidden = false;
    $("aiSource").textContent = `Source: ${res.source} (${res.provider})`;
    $("aiSummary").textContent = res.summary;
    toast(res.source === "llm" ? "LLM summary generated" : "Deterministic summary", "ok");
  } catch (err) {
    toast(err.message, "err");
  } finally {
    $("aiBtn").disabled = false;
  }
}

$("aiBtn").addEventListener("click", runAiSummary);

loadDemoIntoEditor();
loadDemoDocsIntoEditor();
refreshHealth();
refreshCredits();
setInterval(refreshHealth, 15000);
