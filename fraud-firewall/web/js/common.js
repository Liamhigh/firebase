// Shared helpers for the Verum Omnis console (front page + firewall dashboard).

export const $ = (id) => document.getElementById(id);

export function toast(message, kind = "ok") {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3200);
}

export async function api(path, options = {}) {
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
  if (!res.ok) throw new Error(data?.error || res.statusText || "Request failed");
  return data;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sha512Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-512", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function row(k, v) {
  return `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div>`;
}

export async function refreshHealth() {
  const pill = $("healthPill");
  if (!pill) return;
  try {
    const health = await api("/health");
    pill.className = "pill";
    pill.innerHTML = `<span class="dot"></span> ${health.institution || "Online"}`;
  } catch {
    pill.className = "pill err";
    pill.innerHTML = `<span class="dot"></span> Offline`;
  }
}

export async function refreshCredits() {
  const el = $("creditValue");
  if (!el) return;
  try {
    const ledger = await api("/v1/credits");
    el.textContent = String(ledger.credits.remaining);
    el.classList.toggle("bad", ledger.credits.remaining <= 50);
    el.classList.toggle("ok", ledger.credits.remaining > 50);
  } catch {
    el.textContent = "—";
  }
}
