import { $, api, initPage, refreshCredits, toast } from "./shared.js";

initPage("seal");

const fileInput = $("bodyFileInput");
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast("File too large — max 5MB of text", "err");
    fileInput.value = "";
    return;
  }
  const text = await file.text();
  $("bodyInput").value = text;
  if (!$("titleInput").value) $("titleInput").value = file.name;
  toast(`Loaded ${file.name} (${Math.ceil(file.size / 1024)} KB)`);
});

// ---- Sealing pipeline ("green lights") --------------------------------------
// Each step reflects a REAL fact: validation (client), and the sha512 /
// constitution / blockchain / vault outcomes proven by the seal response. We do
// not fake per-step server progress — the steps light up green only once the
// response confirms each part happened.
const PIPELINE_STEPS = ["validate", "hash", "constitution", "ots", "vault"];

function setStep(key, state, detail) {
  const el = document.querySelector(`#sealPipeline .vo-step[data-step="${key}"]`);
  if (!el) return;
  el.classList.remove("is-pending", "is-active", "is-done", "is-warn", "is-error");
  el.classList.add(`is-${state}`);
  if (detail) {
    const sub = el.querySelector(".txt span");
    if (sub) sub.textContent = detail;
  }
}

function resetPipeline() {
  PIPELINE_STEPS.forEach((k) => setStep(k, "pending"));
}

$("sealBtn").addEventListener("click", async () => {
  const documentReference = $("refInput").value.trim();
  const title = $("titleInput").value.trim();
  const bodyText = $("bodyInput").value.trim();
  if (!documentReference || !title || !bodyText) {
    toast("Document reference, title, and document text are all required", "err");
    return;
  }

  const btn = $("sealBtn");
  btn.disabled = true;
  btn.textContent = "Sealing…";

  // Show the pipeline: validation just passed; the seal request is in flight.
  $("sealPipeline").hidden = false;
  resetPipeline();
  setStep("validate", "done");
  setStep("hash", "active", "Hashing & sealing on this server…");

  try {
    const result = await api("/v1/seal", {
      method: "POST",
      body: JSON.stringify({
        document_reference: documentReference,
        title,
        body_text: bodyText,
      }),
    });

    // Light each step from what the response actually proves.
    const seal = result.seal || {};
    setStep("hash", seal.sha512 ? "done" : "error", seal.sha512 ? "Verum forensic fingerprint computed" : "No hash returned");
    setStep(
      "constitution",
      seal.constitution_version ? "done" : "pending",
      seal.constitution_version ? `v${seal.constitution_version} ruleset bound into the seal` : undefined,
    );
    const otsStatus = seal.blockchain && seal.blockchain.status;
    if (otsStatus === "PENDING") {
      setStep("ots", "done", "Submitted — Bitcoin confirmation pending (~1–2 h)");
    } else if (otsStatus === "PENDING_OFFLINE") {
      setStep("ots", "warn", "Calendar offline — hash recorded for retry");
    } else {
      setStep("ots", otsStatus ? "done" : "warn", otsStatus ? `Anchor status: ${otsStatus}` : "Anchor status unavailable");
    }
    setStep("vault", seal.seal_id ? "done" : "error", seal.seal_id ? "Sealed PDF stored in the vault" : "Not stored");

    showSealResult(result);
    await refreshCredits();
    toast(
      result.low_balance_warning
        ? "Document sealed — WARNING: seal credits running low"
        : "Document sealed",
      result.low_balance_warning ? "err" : "ok",
    );
  } catch (err) {
    // Mark whichever step was in flight as failed; earlier green lights stand.
    setStep("hash", "error", err.message);
    toast(err.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Seal Document";
  }
});

function showSealResult(result) {
  const seal = result.seal;
  $("sealResultBlock").hidden = false;
  $("sealIdCode").textContent = seal.seal_id;
  $("sealShaCode").textContent = seal.sha512 || "—";
  $("sealPre").textContent = JSON.stringify(result, null, 2);
  const link = $("downloadSealedPdf");
  link.href = `/v1/sealed/${seal.seal_id}`;
  link.hidden = false;
  $("sealResultBlock").scrollIntoView({ behavior: "smooth", block: "start" });
}

refreshCredits();
