import { mountParticleNetwork } from "./particle-network.js";

const $ = (id) => document.getElementById(id);

const particleCanvas = $("particleNetwork");
if (particleCanvas) mountParticleNetwork(particleCanvas);

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

loadDemoIntoEditor();
refreshHealth();
refreshCredits();
setInterval(refreshHealth, 15000);
