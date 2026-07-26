import { $, api, escapeHtml, initPage, toast } from "./shared.js";

initPage("chat");

const thread = $("chatThread");
const input = $("chatInput");
const sendBtn = $("chatSendBtn");

function addMessage(kind, who, text) {
  const div = document.createElement("div");
  div.className = `msg ${kind}`;
  div.innerHTML = `<span class="who">${escapeHtml(who)}</span>${escapeHtml(text)}`;
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

async function send(message) {
  const text = message.trim();
  if (!text) return;
  addMessage("user", "You", text);
  input.value = "";
  sendBtn.disabled = true;
  try {
    const reply = await api("/v1/chat", {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });
    addMessage("engine", "Guardian Engine", reply.reply);
  } catch (err) {
    addMessage("engine", "Guardian Engine", `Error: ${err.message}`);
    toast(err.message, "err");
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

sendBtn.addEventListener("click", () => send(input.value));
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send(input.value);
  }
});

document.querySelectorAll(".chip[data-ask]").forEach((chip) => {
  chip.addEventListener("click", () => send(chip.dataset.ask));
});

// Opening message comes from the engine itself — real state, not canned copy.
(async () => {
  try {
    const reply = await api("/v1/chat", {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
    });
    addMessage("engine", "Guardian Engine", reply.reply);
  } catch (err) {
    addMessage("engine", "Guardian Engine", `Offline: ${err.message}`);
  }
})();
