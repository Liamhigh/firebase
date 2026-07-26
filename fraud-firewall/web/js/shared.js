import { mountParticleNetwork } from "./particle-network.js";

export const $ = (id) => document.getElementById(id);

export function toast(message, kind = "ok") {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.remove("show");
  }, 3200);
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
  if (!res.ok) {
    throw new Error(data?.error || res.statusText || "Request failed");
  }
  return data;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function refreshHealth() {
  const pill = $("healthPill");
  if (!pill) return;
  try {
    const health = await api("/health");
    pill.className = "pill";
    pill.innerHTML = `<span class="dot"></span> ${escapeHtml(health.institution || "Online")}`;
  } catch {
    pill.className = "pill err";
    pill.innerHTML = `<span class="dot"></span> Offline`;
  }
}

export async function refreshCredits(elementId = "creditValue") {
  const el = $(elementId);
  if (!el) return;
  try {
    const ledger = await api("/v1/credits");
    el.textContent = String(ledger.credits.remaining);
    if (ledger.credits.remaining <= 50) {
      el.classList.add("bad");
      el.classList.remove("ok");
    } else {
      el.classList.remove("bad");
      el.classList.add("ok");
    }
  } catch (err) {
    el.textContent = "—";
    toast(err.message, "err");
  }
}

/**
 * Common page boot: particle background, active nav link, health polling.
 */
export function initPage(activeNav) {
  const canvas = $("particleNetwork");
  if (canvas) mountParticleNetwork(canvas);
  document.querySelectorAll(".topnav a[data-nav]").forEach((a) => {
    if (a.dataset.nav === activeNav) a.classList.add("active");
  });
  refreshHealth();
  setInterval(refreshHealth, 15000);
}
