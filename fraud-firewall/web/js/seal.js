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
  try {
    const result = await api("/v1/seal", {
      method: "POST",
      body: JSON.stringify({
        document_reference: documentReference,
        title,
        body_text: bodyText,
      }),
    });
    showSealResult(result);
    await refreshCredits();
    toast(
      result.low_balance_warning
        ? "Document sealed — WARNING: seal credits running low"
        : "Document sealed",
      result.low_balance_warning ? "err" : "ok",
    );
  } catch (err) {
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
