/**
 * indexedDB.js
 * ---------------------------------------------------------------------------
 * MindGuard — DATABASE LAYER (real implementation, built on the browser's
 * native IndexedDB — no server, no external DB engine, fully on-device).
 *
 * SCOPE — this file (and only this file) owns storage. Per the project spec:
 *
 *   The database RECEIVES, STORES, and RETRIEVES data only.
 *   It does NOT perform emotion detection, AI processing, mood analysis,
 *   mood suggestions, personalized recommendations, or reminder decision
 *   logic. All of that lives in emotionClassifier.js / suggestionManager.js /
 *   notificationHelper.js. This file only ever saves the *results* those
 *   modules hand it, and reads them back.
 *
 * DATA STORED (one IndexedDB object store per domain):
 *   1. users          -> User ID, Full Name, Email Address
 *   2. journalEntries -> Journal Text, Date, Time
 *   3. emotionLogs    -> Detected Emotion (AI output only), Date, Time
 *   4. memories       -> Memory Title, Memory Description, Date  (flashback)
 *   5. reminders      -> Reminder Time, Reminder Status (enabled/disabled)
 *   6. Mood History is NOT a separate store — it is simply emotionLogs read
 *      back as (date, emotion) pairs. Duplicating that data into a second
 *      store would just be the same rows twice, so getMoodHistory() below
 *      derives it on read instead.
 *
 * COMPATIBILITY NOTE: backendManager.js already imports `saveMemory`,
 * `getHappyMemories`, and `deleteMemory` from this file (the old stub). Their
 * names and call shapes are kept 100% identical below so nothing upstream
 * needs to change — they just now actually persist data.
 * ---------------------------------------------------------------------------
 */

import { logger } from "./logger.js";
import { uid } from "./utils.js";

const DB_NAME = "MindGuardDB";
const DB_VERSION = 1;

const STORES = Object.freeze({
  USERS: "users",
  JOURNAL_ENTRIES: "journalEntries",
  EMOTION_LOGS: "emotionLogs",
  MEMORIES: "memories",
  REMINDERS: "reminders",
});

// ---------------------------------------------------------------------------
// Low-level connection + generic CRUD helpers.
// Everything domain-specific further down is built on top of these five
// functions, so there is exactly one place that talks to IndexedDB directly.
// ---------------------------------------------------------------------------

let dbPromise = null;

/** Opens (or creates/upgrades) the MindGuard database. Cached after first call. */
function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.USERS)) {
        const store = db.createObjectStore(STORES.USERS, { keyPath: "userId" });
        store.createIndex("email", "email", { unique: true });
      }

      if (!db.objectStoreNames.contains(STORES.JOURNAL_ENTRIES)) {
        const store = db.createObjectStore(STORES.JOURNAL_ENTRIES, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("date", "date");
        store.createIndex("userId", "userId");
      }

      if (!db.objectStoreNames.contains(STORES.EMOTION_LOGS)) {
        const store = db.createObjectStore(STORES.EMOTION_LOGS, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("date", "date");
        store.createIndex("userId", "userId");
      }

      if (!db.objectStoreNames.contains(STORES.MEMORIES)) {
        const store = db.createObjectStore(STORES.MEMORIES, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("date", "date");
        store.createIndex("userId", "userId");
      }

      if (!db.objectStoreNames.contains(STORES.REMINDERS)) {
        const store = db.createObjectStore(STORES.REMINDERS, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("enabled", "enabled");
        store.createIndex("userId", "userId");
      }

      logger.info("MindGuardDB schema created/upgraded to version", DB_VERSION);
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => {
      logger.error("Failed to open MindGuardDB:", event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

/** Wraps a single IDBRequest in a Promise. */
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Inserts a new record. Returns the generated key (id) for auto-increment stores. */
async function addRecord(storeName, record) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  return promisifyRequest(tx.objectStore(storeName).add(record));
}

/** Inserts or fully replaces a record (used for updates, e.g. favoriting a memory). */
async function putRecord(storeName, record) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  return promisifyRequest(tx.objectStore(storeName).put(record));
}

/** Reads a single record by primary key. */
async function getRecord(storeName, key) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readonly");
  return promisifyRequest(tx.objectStore(storeName).get(key));
}

/** Reads every record in a store. */
async function getAllRecords(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readonly");
  return promisifyRequest(tx.objectStore(storeName).getAll());
}

/** Deletes a record by primary key. */
async function deleteRecord(storeName, key) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  await promisifyRequest(tx.objectStore(storeName).delete(key));
  return true;
}

/** Shared helper: "MMM DD, YYYY" / "HH:MM AM/PM" so every store logs a consistent format. */
function nowParts() {
  const now = new Date();
  return {
    date: now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    iso: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 1. User Information — User ID, Full Name, Email Address
// ---------------------------------------------------------------------------

/**
 * Creates and stores a new user.
 * @param {{ fullName: string, email: string }} input
 * @returns {Promise<object>} the saved user, including its generated userId
 */
export async function saveUser({ fullName, email }) {
  const user = {
    userId: uid("user"),
    fullName,
    email,
    createdAt: nowParts().iso,
  };
  await putRecord(STORES.USERS, user);
  logger.info("User saved:", user.userId);
  return user;
}

/** Retrieves a user by id, or null if not found. */
export async function getUser(userId) {
  const user = await getRecord(STORES.USERS, userId);
  return user ?? null;
}

/** Updates an existing user's fullName/email. */
export async function updateUser(userId, updates) {
  const existing = await getUser(userId);
  if (!existing) throw new Error(`updateUser(): no user found with id "${userId}"`);
  const updated = { ...existing, ...updates, userId };
  await putRecord(STORES.USERS, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// 2. Journal Entries — Journal Text, Date, Time
// ---------------------------------------------------------------------------

/**
 * Stores a journal entry exactly as written by the user (no analysis here).
 * @param {{ text: string, date?: string, time?: string, userId?: string }} input
 */
export async function saveJournalEntry({ text, date, time, userId = null }) {
  const parts = nowParts();
  const entry = {
    text,
    date: date ?? parts.date,
    time: time ?? parts.time,
    userId,
    createdAt: parts.iso,
  };
  const id = await addRecord(STORES.JOURNAL_ENTRIES, entry);
  logger.info("Journal entry saved:", id);
  return { id, ...entry };
}

/** Returns all journal entries (optionally filtered by user), newest first. */
export async function getJournalEntries(userId = null) {
  const all = await getAllRecords(STORES.JOURNAL_ENTRIES);
  const filtered = userId ? all.filter((e) => e.userId === userId) : all;
  return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Deletes a journal entry by id. */
export async function deleteJournalEntry(id) {
  return deleteRecord(STORES.JOURNAL_ENTRIES, id);
}

// ---------------------------------------------------------------------------
// 3. Emotion Data — received FROM the AI model, stored as-is.
//    Fields: Detected Emotion, Date, Time. The database never computes this
//    value itself; callers must pass in whatever emotionClassifier.js output.
// ---------------------------------------------------------------------------

/**
 * Stores one AI-detected emotion result.
 * @param {{ emotion: string, date?: string, time?: string, userId?: string }} input
 */
export async function saveEmotionResult({ emotion, date, time, userId = null }) {
  const parts = nowParts();
  const record = {
    emotion,
    date: date ?? parts.date,
    time: time ?? parts.time,
    userId,
    createdAt: parts.iso,
  };
  const id = await addRecord(STORES.EMOTION_LOGS, record);
  logger.info("Emotion result saved:", id, emotion);
  return { id, ...record };
}

/** Returns all stored emotion results (optionally filtered by user), newest first. */
export async function getEmotionHistory(userId = null) {
  const all = await getAllRecords(STORES.EMOTION_LOGS);
  const filtered = userId ? all.filter((e) => e.userId === userId) : all;
  return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ---------------------------------------------------------------------------
// 6. Mood History — Date + Detected Emotion, for the mood-history display.
//    Derived from emotionLogs (see note at top of file) rather than a
//    duplicate store, oldest -> newest so it plots left-to-right on a chart.
// ---------------------------------------------------------------------------

export async function getMoodHistory(userId = null) {
  const logs = await getEmotionHistory(userId);
  return logs
    .map(({ date, emotion }) => ({ date, emotion }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ---------------------------------------------------------------------------
// 4. Memory Data (Flashback feature) — Memory Title, Memory Description, Date
// ---------------------------------------------------------------------------

/**
 * Saves a happy memory. Kept as `saveMemory({ text, date })` because that is
 * the exact shape backendManager.js's saveCurrentAsMemory() already calls
 * this with — no upstream changes needed. `text` is stored as the memory's
 * description; a title is auto-derived from it when one isn't supplied.
 * @param {{ text?: string, title?: string, date?: string, userId?: string }} input
 */
export async function saveMemory({ text = "", title, date, userId = null }) {
  const parts = nowParts();
  const memoryTitle =
    title ?? (text ? text.slice(0, 40) + (text.length > 40 ? "…" : "") : "Untitled memory");

  const memory = {
    title: memoryTitle,
    description: text,
    text, // alias kept for any existing frontend code reading memory.text
    date: date ?? parts.date,
    favorite: false,
    userId,
    createdAt: parts.iso,
  };

  const id = await addRecord(STORES.MEMORIES, memory);
  logger.info("Memory saved:", id);
  return { id, ...memory };
}

/** Returns all saved memories (optionally filtered by user), newest first. */
export async function getHappyMemories(userId = null) {
  const all = await getAllRecords(STORES.MEMORIES);
  const filtered = userId ? all.filter((m) => m.userId === userId) : all;
  return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Deletes a memory by id. */
export async function deleteMemory(id) {
  return deleteRecord(STORES.MEMORIES, id);
}

/** Persists a favorite toggle for a memory (called from flashbackFavorite()). */
export async function updateMemoryFavorite(id, favorite) {
  const existing = await getRecord(STORES.MEMORIES, id);
  if (!existing) throw new Error(`updateMemoryFavorite(): no memory found with id "${id}"`);
  const updated = { ...existing, favorite };
  await putRecord(STORES.MEMORIES, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// 5. Reminder Settings — Reminder Time, Reminder Status (Enabled/Disabled)
//    Note: this store only remembers what was scheduled and whether it's on.
//    Deciding *when* to fire / whether it's due is notificationHelper.js's
//    job, not the database's.
// ---------------------------------------------------------------------------

/**
 * Saves a reminder. `enabled` is the spec's "Reminder Status"; `notify` is
 * kept as an identical alias since notificationHelper.js's scheduler already
 * checks `reminder.notify` to decide whether to fire.
 * @param {{ message: string, date: string, time: string, enabled?: boolean, userId?: string }} input
 */
export async function saveReminder({ message, date, time, enabled = true, userId = null }) {
  const reminder = {
    message,
    date,
    time,
    enabled,
    notify: enabled,
    userId,
    createdAt: nowParts().iso,
  };
  const id = await addRecord(STORES.REMINDERS, reminder);
  logger.info("Reminder saved:", id);
  return { id, ...reminder };
}

/** Returns all reminders (optionally filtered by user). */
export async function getReminders(userId = null) {
  const all = await getAllRecords(STORES.REMINDERS);
  return userId ? all.filter((r) => r.userId === userId) : all;
}

/** Enables/disables an existing reminder without touching its other fields. */
export async function updateReminderStatus(id, enabled) {
  const existing = await getRecord(STORES.REMINDERS, id);
  if (!existing) throw new Error(`updateReminderStatus(): no reminder found with id "${id}"`);
  const updated = { ...existing, enabled, notify: enabled };
  await putRecord(STORES.REMINDERS, updated);
  return updated;
}

/** Deletes a reminder by id. */
export async function deleteReminder(id) {
  return deleteRecord(STORES.REMINDERS, id);
}
