/* =========================================================
   MOCK DATA LAYER
   In a future version, EMOTION_MODEL results and MEMORY_DB /
   REMINDER_DB reads/writes will be swapped for calls into an
   on-device AI model and a local SQLite database. Everything
   below is a stand-in so the UI can be built and tested now.
========================================================= */

const EMOTIONS = {
  happy:   { label:"Happy",   emoji:"😊", explain:"Your words carry a light, upbeat energy — something today seems to be going right.", suggestions:["🌸 Take a short walk","🎵 Listen to relaxing music","☀️ Spend 10 minutes outside","📖 Read something inspiring","🎨 Try a small creative task","☕ Savor a warm drink slowly"] },
  sad:     { label:"Sad",     emoji:"😔", explain:"There's a heaviness in what you wrote. It's okay to sit with this — you don't have to fix it right away.", suggestions:["💧 Drink some water","🎵 Listen to relaxing music","📞 Reach out to someone you trust","🛁 Take a warm shower","📝 Write down one small win today","🌙 Rest a little earlier tonight"] },
  angry:   { label:"Angry",   emoji:"😡", explain:"Your entry shows some frustration. Giving it space instead of pushing it down can help it pass more gently.", suggestions:["🧘 Deep breathing exercise","🚶 Step outside for fresh air","✍️ Write out what's bothering you","🥤 Drink a cold glass of water","🎧 Play calming instrumental music","⏸️ Pause before responding to anyone"] },
  anxiety: { label:"Anxiety", emoji:"😰", explain:"There's a sense of worry running through your words. Grounding yourself in the present moment may help ease it.", suggestions:["🧘 Deep breathing exercise","🖐️ Try the 5-4-3-2-1 grounding method","💧 Drink some water","🎵 Listen to relaxing music","📵 Take a short break from screens","🕯️ Sit somewhere quiet for a minute"] },
  calm:    { label:"Calm",    emoji:"😌", explain:"You sound settled and at ease right now. A great moment to notice what's working and hold onto it.", suggestions:["📖 Read something inspiring","🎵 Listen to relaxing music","☀️ Spend 10 minutes outside","📝 Jot down what's helping today","🌿 Water a plant or tidy a small space","🧘 A few minutes of quiet stretching"] },
  lonely:  { label:"Lonely",  emoji:"😞", explain:"It sounds like you could use some connection right now. Reaching out, even briefly, can make a real difference.", suggestions:["📞 Message a friend or family member","🐾 Spend time with a pet if you have one","📖 Read something inspiring","🎵 Listen to relaxing music","☀️ Spend 10 minutes outside","✍️ Write a note to your future self"] }
};
const EMOTION_KEYS = Object.keys(EMOTIONS);

let MEMORIES = [
  { id:1, date:"Jun 14, 2026", text:"Had coffee with my sister and we laughed until it hurt. I forgot how much I needed that.", favorite:true },
  { id:2, date:"May 29, 2026", text:"Finished my project ahead of deadline and actually felt proud of myself for once.", favorite:false },
  { id:3, date:"Apr 03, 2026", text:"Walked by the river at sunset, the sky was orange and pink and everything felt still.", favorite:true }
];

let REMINDERS = [
  { id:1, message:"Evening breathing exercise", date:"2026-07-04", time:"21:00", notify:true },
  { id:2, message:"Check in with yourself", date:"2026-07-05", time:"09:30", notify:true }
];

/* =========================================================
   STATE
========================================================= */
let currentEmotionKey = null;
let currentJournalText = "";
let suggestionOffset = 0;
let flashbackIndex = -1;
let memoryIdCounter = 4;
let reminderIdCounter = 3;

/* =========================================================
   NAVIGATION
========================================================= */
function goTo(screen){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + screen).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.screen === screen));
  window.scrollTo({top:0, behavior:'smooth'});
  if(screen === 'memories') renderMemories();
  if(screen === 'reminders') renderReminders();
}

/* =========================================================
   JOURNAL / CHAR COUNT
========================================================= */
function updateCharCount(){
  const val = document.getElementById('journalInput').value;
  document.getElementById('charCount').textContent = `${val.length} / 1200`;
  const words = val.trim().length ? val.trim().split(/\s+/).length : 0;
  document.getElementById('wordCount').textContent = `${words} word${words===1?'':'s'}`;
}

/* =========================================================
   MOCK EMOTION ANALYSIS
   Placeholder for on-device AI inference. Currently uses light
   keyword hints with a random fallback to simulate a model.
========================================================= */
function mockAnalyze(text){
  const t = text.toLowerCase();
  const hints = {
    happy:   ["happy","great","excited","joy","glad","grateful","smile","fun"],
    sad:     ["sad","down","cry","upset","hurt","depress","empty"],
    angry:   ["angry","mad","furious","annoyed","frustrat","hate","rage"],
    anxiety: ["anxious","worried","nervous","panic","overwhelm","stress","scared"],
    calm:    ["calm","peace","relax","fine","okay","settled","content"],
    lonely:  ["lonely","alone","isolat","no one","miss them","empty inside"]
  };
  for(const key of EMOTION_KEYS){
    if(hints[key].some(w => t.includes(w))){
      return { key, confidence: 78 + Math.floor(Math.random()*18) };
    }
  }
  const key = EMOTION_KEYS[Math.floor(Math.random()*EMOTION_KEYS.length)];
  return { key, confidence: 60 + Math.floor(Math.random()*25) };
}

function analyzeEmotion(){
  const text = document.getElementById('journalInput').value.trim();
  if(!text){
    toast("Write a little about how you feel first 💬");
    return;
  }
  currentJournalText = text;
  const btn = document.getElementById('analyzeBtn');
  btn.textContent = "Analyzing…";
  btn.disabled = true;

  setTimeout(() => {
    const { key, confidence } = mockAnalyze(text);
    currentEmotionKey = key;
    renderEmotionResult(key, confidence);
    renderSuggestions(key, true);
    btn.textContent = "Analyze Emotion";
    btn.disabled = false;
    document.getElementById('emotionResultCard').classList.remove('hidden');
    document.getElementById('suggestionsCard').classList.remove('hidden');
    document.getElementById('emotionResultCard').scrollIntoView({behavior:'smooth', block:'nearest'});
  }, 700);
}

function renderEmotionResult(key, confidence){
  const e = EMOTIONS[key];
  document.getElementById('emotionEmoji').textContent = e.emoji;
  document.getElementById('emotionLabel').textContent = e.label;
  document.getElementById('emotionExplain').textContent = e.explain;
  document.getElementById('confidenceNum').textContent = confidence + "%";
  const fill = document.getElementById('confidenceFill');
  fill.style.width = "0%";
  requestAnimationFrame(() => { fill.style.width = confidence + "%"; });
  document.getElementById('saveMemoryBtn').classList.toggle('hidden', key !== 'happy');
}

function renderSuggestions(key, reset){
  if(reset) suggestionOffset = 0;
  const list = EMOTIONS[key].suggestions;
  const grid = document.getElementById('suggestionsGrid');
  grid.innerHTML = "";
  const slice = list.slice(0, Math.min(list.length, suggestionOffset + 4)).slice(suggestionOffset === 0 ? 0 : suggestionOffset);
  const shown = reset ? list.slice(0,4) : list.slice(suggestionOffset, suggestionOffset+4);
  shown.forEach(item => {
    const [icon, ...rest] = item.split(" ");
    const div = document.createElement('div');
    div.className = "suggestion-card";
    div.innerHTML = `<div class="suggestion-icon">${icon}</div><div class="suggestion-text">${rest.join(" ")}</div>`;
    grid.appendChild(div);
  });
}

function showMoreSuggestions(){
  if(!currentEmotionKey) return;
  const list = EMOTIONS[currentEmotionKey].suggestions;
  suggestionOffset = (suggestionOffset + 4) % list.length;
  renderSuggestions(currentEmotionKey, false);
}

/* =========================================================
   MEMORIES
========================================================= */
function saveCurrentAsMemory(){
  if(!currentJournalText) return;
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'numeric' });
  MEMORIES.unshift({ id: memoryIdCounter++, date: dateStr, text: currentJournalText, favorite:false });
  toast("Saved to Happy Memories ❤️");
  renderMemories();
}

function renderMemories(){
  const wrap = document.getElementById('memoryList');
  if(MEMORIES.length === 0){
    wrap.innerHTML = `<div class="empty-state"><span class="empty-emoji">❤️</span><span class="empty-text">Your happy memories will appear here ❤️</span></div>`;
    return;
  }
  const privacy = document.getElementById('privacyToggle').checked;
  wrap.innerHTML = "";
  MEMORIES.forEach(m => {
    const div = document.createElement('div');
    div.className = "memory-card";
    div.innerHTML = `
      <div class="memory-top">
        <span class="memory-date">${m.date}</span>
        <button class="btn-icon" style="width:30px;height:30px;font-size:0.9rem;" onclick="toggleFavoriteMemory(${m.id})" title="Favorite">${m.favorite ? '❤️' : '🤍'}</button>
      </div>
      <div class="memory-preview" style="${privacy ? 'filter:blur(5px); user-select:none;' : ''}">${escapeHtml(m.text)}</div>
      <div class="memory-actions">
        <button class="btn btn-ghost btn-sm" onclick="deleteMemory(${m.id})">Delete</button>
      </div>`;
    wrap.appendChild(div);
  });
}

function toggleFavoriteMemory(id){
  const m = MEMORIES.find(x => x.id === id);
  if(m){ m.favorite = !m.favorite; renderMemories(); }
}

function deleteMemory(id){
  MEMORIES = MEMORIES.filter(x => x.id !== id);
  toast("Memory deleted");
  renderMemories();
}

/* =========================================================
   FLASHBACKS
========================================================= */
function showHappyMemory(){
  if(MEMORIES.length === 0){
    toast("No happy memories saved yet");
    return;
  }
  flashbackIndex = Math.floor(Math.random() * MEMORIES.length);
  renderFlashback();
}

function flashbackNav(dir){
  if(MEMORIES.length === 0 || flashbackIndex === -1) return;
  flashbackIndex = (flashbackIndex + dir + MEMORIES.length) % MEMORIES.length;
  renderFlashback();
}

function flashbackFavorite(){
  if(flashbackIndex === -1) return;
  const m = MEMORIES[flashbackIndex];
  m.favorite = !m.favorite;
  renderFlashback();
}

function renderFlashback(){
  const stage = document.getElementById('flashbackStage');
  if(flashbackIndex === -1 || MEMORIES.length === 0){
    stage.innerHTML = `<div class="empty-state" id="flashbackEmpty"><span class="empty-emoji">❤️</span><span class="empty-text">Your happy memories will appear here ❤️</span></div>`;
    return;
  }
  const m = MEMORIES[flashbackIndex];
  stage.innerHTML = `
    <div class="flashback-content">
      <div class="flashback-date">${m.date}</div>
      <div class="flashback-text">"${escapeHtml(m.text)}"</div>
    </div>`;
  document.getElementById('fbFav').textContent = m.favorite ? '❤️' : '🤍';
}

/* =========================================================
   REMINDERS
========================================================= */
function addReminder(){
  const msg = document.getElementById('remMsg').value.trim();
  const date = document.getElementById('remDate').value;
  const time = document.getElementById('remTime').value;
  const notify = document.getElementById('remNotify').checked;

  if(!msg || !date || !time){
    toast("Fill in message, date, and time");
    return;
  }
  REMINDERS.push({ id: reminderIdCounter++, message: msg, date, time, notify });
  REMINDERS.sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
  document.getElementById('remMsg').value = "";
  document.getElementById('remDate').value = "";
  document.getElementById('remTime').value = "";
  toast("Reminder added ⏰");
  renderReminders();
}

function deleteReminder(id){
  REMINDERS = REMINDERS.filter(r => r.id !== id);
  renderReminders();
}

function renderReminders(){
  const wrap = document.getElementById('reminderList');
  if(REMINDERS.length === 0){
    wrap.innerHTML = `<div class="empty-state"><span class="empty-emoji">⏰</span><span class="empty-text">No reminders yet.</span></div>`;
    return;
  }
  wrap.innerHTML = "";
  REMINDERS.forEach(r => {
    const dateObj = new Date(r.date + "T" + r.time);
    const niceDate = isNaN(dateObj) ? r.date : dateObj.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    const div = document.createElement('div');
    div.className = "reminder-card";
    div.innerHTML = `
      <div class="reminder-info">
        <div class="reminder-msg">${escapeHtml(r.message)}</div>
        <div class="reminder-time">${niceDate} · ${formatTime(r.time)} ${r.notify ? '· 🔔' : '· 🔕'}</div>
      </div>
      <button class="btn-icon" style="width:32px;height:32px;font-size:0.85rem;" onclick="deleteReminder(${r.id})" title="Delete">✕</button>`;
    wrap.appendChild(div);
  });
}

function formatTime(t){
  if(!t) return "";
  const [h,m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = ((h % 12) || 12);
  return `${hh}:${String(m).padStart(2,'0')} ${period}`;
}

/* =========================================================
   SETTINGS
========================================================= */
function toggleDarkMode(){
  const on = document.getElementById('darkModeToggle').checked;
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  toast(on ? "Dark mode on" : "Dark mode off");
}

function togglePrivacyMode(){
  toast(document.getElementById('privacyToggle').checked ? "Privacy mode on — previews blurred" : "Privacy mode off");
  renderMemories();
}

/* =========================================================
   UTIL
========================================================= */
let toastTimer;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* =========================================================
   INIT
========================================================= */
(function init(){
  updateCharCount();
  renderMemories();
  renderReminders();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('remDate').min = today;
})();