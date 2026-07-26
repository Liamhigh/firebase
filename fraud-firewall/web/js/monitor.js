import { $, api, initPage, refreshCredits, toast } from "./shared.js";

initPage("monitor");

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
  $("runDemoBtn").classList.add("is-disabled");
  try {
    const result = await api("/v1/monitor", {
      method: "POST",
      body: JSON.stringify({ transactions }),
    });
    showResult(result);
    await refreshCredits();
    toast(
      result.message || "Monitor complete",
      result.alert?.status === "CONFIRMED" ? "ok" : "err",
    );
  } catch (err) {
    toast(err.message, "err");
  } finally {
    $("monitorBtn").disabled = false;
    $("runDemoBtn").classList.remove("is-disabled");
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

$("runDemoBtn").addEventListener("click", async (event) => {
  event.preventDefault();
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

loadDemoIntoEditor();
refreshCredits();
