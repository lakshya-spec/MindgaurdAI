/**
 * script.js
 * ---------------------------------------------------------------------------
 * MindGuard AI — frontend controller, now wired to the real on-device
 * backend (backendManager.js) instead of mock data. Screen ids, element ids,
 * and function names are unchanged from the mock version so the HTML/CSS
 * files don't need to change — only what happens *inside* these functions
 * is now backed by Transformers.js inference + IndexedDB persistence.
 *
 * This file is a native ES module (it uses `import`), so index.html must
 * load it as:  <script type="module" src="script.js"></script>
 * ---------------------------------------------------------------------------
 */

import * as backend from "./backendManager.js";

/* =========================================================
   STATE
========================================================= */
let currentEmotionKey = null;
let currentJournalText = "";

/* =========================================================
   NAVIGATION
========================================================= */
function goTo(screen) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById("screen-" + screen).classList.add("active");
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.toggle("active", n.dataset.screen === screen));
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (screen === "memories") renderMemories();
  if (screen === "reminders") renderReminders();
}
window.goTo = goTo; // used by inline onclick="" handlers in index.html

/* =========================================================
   JOURNAL / CHAR COUNT
========================================================= */
function updateCharCount() {
  const val = document.getElementById("journalInput").value;
  document.getElementById("charCount").textContent = `${val.length} / 1200`;
  const words = val.trim().length ? val.trim().split(/\s+/).length : 0;
  document.getElementById("wordCount").textContent = `${words} word${words === 1 ? "" : "s"}`;
}
window.updateCharCount = updateCharCount;

/* =========================================================
   EMOTION ANALYSIS (real on-device inference via backendManager)
========================================================= */
async function analyzeEmotion() {
  const text = document.getElementById("journalInput").value.trim();
  if (!text) {
    toast("Write a little about how you feel first 💬");
    return;
  }
  currentJournalText = text;

  const btn = document.getElementById("analyzeBtn");
  const originalLabel = btn.textContent;
  btn.textContent = "Analyzing…";
  btn.disabled = true;

  try {
    const { result, suggestions } = await backend.analyzeEmotion(text);
    currentEmotionKey = result.key;

    renderEmotionResult(result);
    renderSuggestionsList(suggestions);

    document.getElementById("emotionResultCard").classList.remove("hidden");
    document.getElementById("suggestionsCard").classList.remove("hidden");
    document.getElementById("emotionResultCard").scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    console.error(err);
    toast("Couldn't analyze that just now — the model may still be loading.");
  } finally {
    btn.textContent = originalLabel;
    btn.disabled = false;
  }
}
window.analyzeEmotion = analyzeEmotion;

function renderEmotionResult(result) {
  document.getElementById("emotionEmoji").textContent = result.emoji;
  document.getElementById("emotionLabel").textContent = result.label;
  document.getElementById("emotionExplain").textContent = result.isLowConfidence
    ? `${result.explain} (This one was a little harder to read — take it as a gentle guess.)`
    : result.explain;

  document.getElementById("confidenceNum").textContent = result.confidence + "%";
  const fill = document.getElementById("confidenceFill");
  fill.style.width = "0%";
  requestAnimationFrame(() => {
    fill.style.width = result.confidence + "%";
  });

  document.getElementById("saveMemoryBtn").classList.toggle("hidden", result.key !== "happy");
}

function renderSuggestionsList(list) {
  const grid = document.getElementById("suggestionsGrid");
  grid.innerHTML = "";
  list.forEach((item) => {
    const [icon, ...rest] = item.split(" ");
    const div = document.createElement("div");
    div.className = "suggestion-card";
    div.innerHTML = `<div class="suggestion-icon">${icon}</div><div class="suggestion-text">${rest.join(" ")}</div>`;
    grid.appendChild(div);
  });
}

function showMoreSuggestions() {
  if (!currentEmotionKey) return;
  const list = backend.showMoreSuggestions();
  renderSuggestionsList(list);
}
window.showMoreSuggestions = showMoreSuggestions;

/* =========================================================
   MEMORIES
========================================================= */
async function saveCurrentAsMemory() {
  if (!currentJournalText) return;
  try {
    await backend.saveCurrentAsMemory(currentJournalText);
    toast("Saved to Happy Memories ❤️");
    renderMemories();
  } catch (err) {
    console.error(err);
    toast("Couldn't save that memory — please try again.");
  }
}
window.saveCurrentAsMemory = saveCurrentAsMemory;

function renderMemories() {
  const wrap = document.getElementById("memoryList");
  const memories = backend.getMemoryList();

  if (memories.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><span class="empty-emoji">❤️</span><span class="empty-text">Your happy memories will appear here ❤️</span></div>`;
    return;
  }

  const privacy = document.getElementById("privacyToggle")?.checked;
  wrap.innerHTML = "";
  memories.forEach((m) => {
    const div = document.createElement("div");
    div.className = "memory-card";
    div.innerHTML = `
      <div class="memory-top">
        <span class="memory-date">${m.date}</span>
        <button class="btn-icon" style="width:30px;height:30px;font-size:0.9rem;" onclick="toggleFavoriteMemory(${m.id})" title="Favorite">${m.favorite ? "❤️" : "🤍"}</button>
      </div>
      <div class="memory-preview" style="${privacy ? "filter:blur(5px); user-select:none;" : ""}">${escapeHtml(m.text)}</div>
      <div class="memory-actions">
        <button class="btn btn-ghost btn-sm" onclick="deleteMemoryHandler(${m.id})">Delete</button>
      </div>`;
    wrap.appendChild(div);
  });
}

async function toggleFavoriteMemory(id) {
  try {
    await backend.toggleMemoryFavorite(id);
    renderMemories();
  } catch (err) {
    console.error(err);
  }
}
window.toggleFavoriteMemory = toggleFavoriteMemory;

async function deleteMemoryHandler(id) {
  try {
    await backend.removeMemory(id);
    toast("Memory deleted");
    renderMemories();
  } catch (err) {
    console.error(err);
    toast("Couldn't delete that memory.");
  }
}
window.deleteMemoryHandler = deleteMemoryHandler;

/* =========================================================
   FLASHBACKS
========================================================= */
function showHappyMemory() {
  const memory = backend.showHappyMemory();
  if (!memory) {
    toast("No happy memories saved yet");
    return;
  }
  renderFlashback(memory);
}
window.showHappyMemory = showHappyMemory;

function flashbackNav(dir) {
  const memory = backend.flashbackNav(dir);
  if (memory) renderFlashback(memory);
}
window.flashbackNav = flashbackNav;

async function flashbackFavorite() {
  const memory = await backend.flashbackFavorite();
  if (memory) renderFlashback(memory);
}
window.flashbackFavorite = flashbackFavorite;

function renderFlashback(memory) {
  const stage = document.getElementById("flashbackStage");
  if (!memory) {
    stage.innerHTML = `<div class="empty-state" id="flashbackEmpty"><span class="empty-emoji">❤️</span><span class="empty-text">Your happy memories will appear here ❤️</span></div>`;
    return;
  }
  stage.innerHTML = `
    <div class="flashback-content">
      <div class="flashback-date">${memory.date}</div>
      <div class="flashback-text">"${escapeHtml(memory.text)}"</div>
    </div>`;
  const favBtn = document.getElementById("fbFav");
  if (favBtn) favBtn.textContent = memory.favorite ? "❤️" : "🤍";
}

/* =========================================================
   REMINDERS
========================================================= */
async function addReminder() {
  const msg = document.getElementById("remMsg").value.trim();
  const date = document.getElementById("remDate").value;
  const time = document.getElementById("remTime").value;
  const notify = document.getElementById("remNotify").checked;

  if (!msg || !date || !time) {
    toast("Fill in message, date, and time");
    return;
  }

  try {
    await backend.addReminder({ message: msg, date, time, notify });
    document.getElementById("remMsg").value = "";
    document.getElementById("remDate").value = "";
    document.getElementById("remTime").value = "";
    toast("Reminder added ⏰");
    renderReminders();
  } catch (err) {
    console.error(err);
    toast("Couldn't save that reminder.");
  }
}
window.addReminder = addReminder;

async function deleteReminderHandler(id) {
  try {
    await backend.removeReminder(id);
    renderReminders();
  } catch (err) {
    console.error(err);
    toast("Couldn't delete that reminder.");
  }
}
window.deleteReminderHandler = deleteReminderHandler;

function renderReminders() {
  const wrap = document.getElementById("reminderList");
  // getReminders() in the real indexedDB.js doesn't sort — order chronologically here.
  const reminders = [...backend.getReminderList()].sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)
  );

  if (reminders.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><span class="empty-emoji">⏰</span><span class="empty-text">No reminders yet.</span></div>`;
    return;
  }

  wrap.innerHTML = "";
  reminders.forEach((r) => {
    const dateObj = new Date(r.date + "T" + r.time);
    const niceDate = isNaN(dateObj) ? r.date : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const div = document.createElement("div");
    div.className = "reminder-card";
    div.innerHTML = `
      <div class="reminder-info">
        <div class="reminder-msg">${escapeHtml(r.message)}</div>
        <div class="reminder-time">${niceDate} · ${formatTime(r.time)} ${r.notify ? "· 🔔" : "· 🔕"}</div>
      </div>
      <button class="btn-icon" style="width:32px;height:32px;font-size:0.85rem;" onclick="deleteReminderHandler(${r.id})" title="Delete">✕</button>`;
    wrap.appendChild(div);
  });
}

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = (h % 12) || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${period}`;
}

/* =========================================================
   SETTINGS
========================================================= */
function toggleDarkMode() {
  const on = document.getElementById("darkModeToggle").checked;
  document.documentElement.setAttribute("data-theme", on ? "dark" : "light");
  toast(on ? "Dark mode on" : "Dark mode off");
}
window.toggleDarkMode = toggleDarkMode;

function togglePrivacyMode() {
  toast(document.getElementById("privacyToggle").checked ? "Privacy mode on — previews blurred" : "Privacy mode off");
  renderMemories();
}
window.togglePrivacyMode = togglePrivacyMode;

/* =========================================================
   UTIL
========================================================= */
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* =========================================================
   INIT
========================================================= */
async function init() {
  updateCharCount();

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("remDate").min = today;

  // Render whatever's already cached (empty on first-ever load), then
  // hydrate from the real backend — model load + IndexedDB restore.
  renderMemories();
  renderReminders();

  try {
    await backend.initialize();
    renderMemories(); // re-render with data restored from IndexedDB
    renderReminders();
  } catch (err) {
    console.error("Backend initialization failed:", err);
    toast("Running in limited mode — on-device model failed to load.");
  }
}

document.addEventListener("DOMContentLoaded", init);