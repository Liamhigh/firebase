import { $, api, escapeHtml, initPage, refreshCredits, toast } from "./shared.js";

initPage("vault");

async function refreshVault() {
  try {
    const [evidenceRes, findingsRes] = await Promise.all([
      api("/v1/evidence"),
      api("/v1/findings"),
    ]);

    const evidence = evidenceRes.evidence || [];
    $("evidenceCountValue").textContent = String(evidence.length);

    const list = $("evidenceList");
    if (evidence.length === 0) {
      list.innerHTML =
        '<div class="empty-note">The evidence buffer is empty. Ingest documents on the ' +
        '<a href="/report.html">Forensic Report</a> page, then run a scan.</div>';
    } else {
      list.innerHTML = evidence
        .map(
          (e) => `
          <div class="vault-item">
            <span class="icon">📄</span>
            <span>
              <span class="name">${escapeHtml(e.source_file)}</span>
              <span class="meta">${escapeHtml(e.evidence_id)}</span>
            </span>
            <span class="type">${escapeHtml(e.type)}</span>
          </div>`,
        )
        .join("");
    }

    const manifest = findingsRes.manifest;
    const contradictions = findingsRes.contradictions || [];
    $("atomCountValue").textContent = String(manifest?.atom_count ?? "—");
    const contraEl = $("contraCountValue");
    contraEl.textContent = String(manifest?.contradiction_count ?? "—");
    contraEl.className =
      "value " + (manifest ? (manifest.contradiction_count > 0 ? "bad" : "ok") : "");

    const summary = $("findingsSummary");
    if (manifest) {
      summary.innerHTML =
        `<p class="sub">Last scan ${escapeHtml(manifest.generated_at)} — ` +
        `${manifest.document_count} document(s), ${manifest.atom_count} evidence atom(s), ` +
        `${manifest.contradiction_count} contradiction(s). ` +
        `Full detail on the <a href="/report.html">Forensic Report</a> page.</p>` +
        (contradictions.length
          ? `<div class="contra-list">${contradictions
              .slice(0, 5)
              .map(
                (c) => `
              <div class="contra-card sev-${c.severity}">
                <div class="contra-head">
                  <span class="contra-id">${escapeHtml(c.contradiction_id)}</span>
                  <span class="badge">${escapeHtml(c.brain_source)}</span>
                  <span class="badge sev-${c.severity}">${escapeHtml(c.severity)}</span>
                  <span class="badge">${escapeHtml(c.confidence)}</span>
                  ${c.triple_ai_consensus?.quorum ? '<span class="badge quorum">QUORUM ✓</span>' : ""}
                </div>
              </div>`,
              )
              .join("")}</div>`
          : "");
    } else {
      summary.innerHTML =
        '<div class="empty-note">No forensic scan has been run yet — start one on the ' +
        '<a href="/report.html">Forensic Report</a> page.</div>';
    }
  } catch (err) {
    toast(err.message, "err");
  }
}

$("refreshVaultBtn").addEventListener("click", () => {
  refreshVault();
  refreshCredits();
  toast("Vault refreshed");
});

refreshVault();
refreshCredits();
