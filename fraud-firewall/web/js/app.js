import { $, toast, api, escapeHtml, sha512Hex, row, refreshHealth, refreshCredits } from "./common.js";

/* ============================================================
   Verum Omnis — Investigator workspace (front page)
   Load & seal evidence  →  read the sealed report  →  ask the AI.
   ============================================================ */

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
  const ent = findings.entities?.length ?? 0;
  const consensus = findings.consensus;
  const consensusStr = consensus ? ` · consensus ${consensus.verdict} (${consensus.count} brains)` : "";
  $("extractMessage").textContent =
    `${findings.atom_count} evidence atom(s) · ${contradictions.length} contradiction(s) · ` +
    `${tl} timeline event(s) · ${off} offence(s) · ${ent} part(y/ies)${consensusStr}.`;

  const idxCount = $("contraIndexCount");
  if (idxCount) idxCount.textContent = String(contradictions.length);

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

  // The forensic PDF report comes out ON SCREEN (raw JSON stays in the vault).
  const reportBlock = $("sealedReport");
  const rowEl = $("extractDownloadRow");
  const link = $("downloadFindingsSeal");
  const frame = $("sealedFrame");
  if (result.seal?.seal_id) {
    reportBlock.hidden = false;
    rowEl.hidden = false;
    frame.src = `/v1/sealed/${result.seal.seal_id}?inline=1`;
    link.href = `/v1/sealed/${result.seal.seal_id}`;
  } else {
    reportBlock.hidden = true;
    rowEl.hidden = true;
    frame.src = "about:blank";
  }
}

$("printFindingsSeal")?.addEventListener("click", () => {
  const frame = $("sealedFrame");
  try {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  } catch {
    window.open(frame.src, "_blank", "noreferrer");
  }
});

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
  const coords = await getGeo();
  const geoQs = coords ? `&lat=${coords.latitude}&lon=${coords.longitude}&acc=${coords.accuracy ?? ""}` : "";
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
  status.textContent = `Sealed ${uploadedCount} file(s) into the vault: ${names.join(", ")}. Click "Extract & Seal" to analyse.`;
  toast(`Ingested ${names.length} file(s)`, "ok");
}

$("evidenceFiles")?.addEventListener("change", (e) => {
  const files = e.target.files;
  if (files && files.length) uploadEvidenceFiles([...files]);
});

$("clearEvidenceBtn")?.addEventListener("click", async () => {
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

$("loadDemoDocsBtn")?.addEventListener("click", () => {
  $("docInput").value = JSON.stringify(DEMO_DOCS, null, 2);
  toast("Demo evidence loaded");
});

$("extractBtn")?.addEventListener("click", async () => {
  const raw = $("docInput").value.trim();
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

/* ---------------- Ask Verum Omnis (chat) ---------------- */

const chatHistory = [];

const VERDICT_LABEL = {
  VERIFIED: { cls: "verified", text: "TRIPLE-AI VERIFIED" },
  PARTIAL: { cls: "pending", text: "PARTIALLY VERIFIED" },
  UNVERIFIED: { cls: "tampered", text: "UNVERIFIED — treat with caution" },
  UNVERIFIED_NO_SEALED_EVIDENCE: { cls: "notfound", text: "NO SEALED EVIDENCE — seal evidence first" },
};

function verificationHtml(v) {
  if (!v) return "";
  const badge = VERDICT_LABEL[v.verdict] || { cls: "notfound", text: v.verdict };
  const votes = v.verifiers
    .map((x) => `${escapeHtml(x.name)}: ${x.vote === "CONCUR" ? "✓" : "⟳"}`)
    .join(" · ");
  return `<div class="verify-chip ${badge.cls}" title="${escapeHtml(votes)}">
      ${badge.text} · quorum ${v.quorum}/${v.threshold}
    </div>
    <div class="verify-votes">${votes}</div>`;
}

function appendMessage(role, text, { sealable = false, verification = null } = {}) {
  const log = $("chatLog");
  if (!log) return null;
  const wrap = document.createElement("div");
  wrap.className = `chat-msg ${role}`;
  const who = role === "user" ? "You" : "Verum Omnis";
  wrap.innerHTML =
    `<div class="chat-who">${who}</div><div class="chat-body">${escapeHtml(text)}</div>` +
    (role === "assistant" ? verificationHtml(verification) : "");
  if (sealable) {
    const actions = document.createElement("div");
    actions.className = "chat-actions";
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost btn-small";
    btn.textContent = "Seal answer as PDF";
    btn.addEventListener("click", () => sealAnswer(text, verification, btn));
    actions.appendChild(btn);
    wrap.appendChild(actions);
  }
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
  return wrap;
}

async function sealAnswer(text, verification, btn) {
  btn.disabled = true;
  btn.textContent = "Sealing…";
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const verifyBlock = verification
      ? [
          "",
          "TRIPLE-AI VERIFICATION:",
          `- Verdict: ${verification.verdict}`,
          `- Quorum: ${verification.quorum} of ${verification.threshold} verifiers concurred`,
          `- Grounding score: ${verification.grounding_score}`,
          ...verification.verifiers.map((v) => `- ${v.name}: ${v.vote} — ${v.detail}`),
        ].join("\n")
      : "";
    const result = await api("/v1/seal", {
      method: "POST",
      body: JSON.stringify({
        document_reference: `VO-CHAT-${stamp}`,
        title: "Verum Omnis — Sealed AI Response",
        body_text: `${text}\n${verifyBlock}`,
      }),
    });
    await refreshCredits();
    const id = result.seal?.seal_id;
    if (id) {
      const link = document.createElement("a");
      link.className = "btn btn-ghost btn-small";
      link.href = `/v1/sealed/${id}?inline=1`;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Open sealed PDF";
      btn.replaceWith(link);
      toast("Answer sealed — it is now court-usable evidence", "ok");
    } else {
      btn.textContent = "Seal answer as PDF";
      btn.disabled = false;
    }
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "Seal answer as PDF";
    btn.disabled = false;
  }
}

async function sendChat() {
  const input = $("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  const deep = $("chatDeepChk")?.checked;
  const outbound = deep ? `[DEEP RESEARCH] ${msg}` : msg;
  input.value = "";
  appendMessage("user", msg);
  chatHistory.push({ role: "user", content: outbound });
  $("chatSendBtn").disabled = true;
  const thinking = appendMessage("assistant", "…thinking");
  try {
    const res = await api("/v1/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message: outbound, history: chatHistory.slice(0, -1) }),
    });
    thinking?.remove();
    appendMessage("assistant", res.reply, { sealable: true, verification: res.verification });
    chatHistory.push({ role: "assistant", content: res.reply });
    const src = $("chatSource");
    if (src) {
      const v = res.verification;
      src.textContent = `Source: ${res.source} (${res.provider})` + (v ? ` · verification ${v.verdict} (${v.quorum}/${v.threshold})` : "");
    }
  } catch (err) {
    thinking?.remove();
    appendMessage("assistant", `Error: ${err.message}`);
  } finally {
    $("chatSendBtn").disabled = false;
    input.focus();
  }
}

$("chatSendBtn")?.addEventListener("click", sendChat);
$("chatInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

/* ---------------- Seal verification ---------------- */

const VERIFY_BANNER = {
  VERIFIED: { cls: "verified", text: "VERIFIED — sealed & anchored" },
  SEAL_FOUND_PENDING_CHAIN: { cls: "pending", text: "SEAL VALID — blockchain pending" },
  TAMPERED: { cls: "tampered", text: "TAMPERED — hash mismatch" },
  NOT_FOUND: { cls: "notfound", text: "NOT FOUND — no such seal" },
  INDETERMINATE: { cls: "pending", text: "SEAL FOUND — supply the PDF to verify" },
};

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
    if (file) sha512 = await sha512Hex(await file.arrayBuffer());
    const res = await api("/v1/verify", {
      method: "POST",
      body: JSON.stringify({ seal_id: sealId || undefined, sha512 }),
    });
    renderVerification(res);
    const ok = res.result === "VERIFIED" || res.result === "SEAL_FOUND_PENDING_CHAIN";
    toast(res.result.replace(/_/g, " "), ok ? "ok" : "err");
  } catch (err) {
    toast(err.message, "err");
  } finally {
    $("verifyBtn").disabled = false;
  }
}

$("verifyBtn")?.addEventListener("click", runVerify);

/* ---------------- Boot ---------------- */
refreshHealth();
refreshCredits();
setInterval(refreshHealth, 15000);
