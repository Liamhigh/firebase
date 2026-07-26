import { $, api, escapeHtml, initPage, refreshCredits, toast } from "./shared.js";

initPage("report");

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

function renderFindings(result) {
  const findings = result.findings || result;
  const contradictions = findings.contradictions || [];
  $("extractResultBlock").hidden = false;
  $("docCountValue").textContent = String(findings.document_count ?? "—");
  $("atomCountValue").textContent = String(findings.atom_count ?? "—");
  const contraEl = $("contraCountValue");
  contraEl.textContent = String(findings.contradiction_count ?? contradictions.length);
  contraEl.className = "value " + (contradictions.length ? "bad" : "ok");

  $("extractMessage").textContent = contradictions.length
    ? `${contradictions.length} contradiction(s) detected across ${findings.atom_count} evidence atom(s). ` +
      "Findings are forensic indicators for human review — not determinations of fraud."
    : `No contradictions detected across ${findings.atom_count} evidence atom(s).`;

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
      count ? `${count} contradiction(s) detected` : "Forensic scan complete — no contradictions",
      count ? "err" : "ok",
    );
  } catch (err) {
    toast(err.message, "err");
  } finally {
    $("extractBtn").disabled = false;
  }
}

$("loadDemoDocsBtn").addEventListener("click", () => {
  loadDemoDocsIntoEditor();
  toast("Demo evidence loaded");
});

$("extractBtn").addEventListener("click", async () => {
  let documents;
  try {
    const parsed = JSON.parse($("docInput").value || "[]");
    documents = Array.isArray(parsed) ? parsed : parsed.documents;
    if (!Array.isArray(documents)) throw new Error("Expected a JSON array of documents");
  } catch (err) {
    toast(`Invalid JSON: ${err.message}`, "err");
    return;
  }
  await runExtract(documents, $("sealFindingsChk").checked);
});

loadDemoDocsIntoEditor();
refreshCredits();
