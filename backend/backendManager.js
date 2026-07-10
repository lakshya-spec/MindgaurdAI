/**
 * backendManager.js
 * ---------------------------------------------------------------------------
 * Central controller for the MindGuard AI on-device backend. This is the
 * single entry point meant to be imported wherever the frontend eventually
 * wires the backend in (script.js is left untouched per instructions — this
 * module is additive and self-contained).
 *
 * Exposed methods intentionally mirror the frontend's existing function
 * names/behavior (analyzeEmotion, saveCurrentAsMemory, showHappyMemory,
 * showMoreSuggestions, flashbackFavorite, flashbackNav, addReminder) so that
 * integrating them later is a matter of calling into `backendManager` from
 * inside the corresponding script.js function, not rewriting anything.
 *
 * Everything below runs 100% locally: model inference via Transformers.js,
 * suggestions from a static in-memory table, notifications via the native
 * browser API, and persistence via indexedDB.js (the real database layer,
 * built on the browser's native IndexedDB — see that file for schema
 * details). This module never touches storage directly; it only ever reads
 * from / writes to indexedDB.js's exported functions.
 * ---------------------------------------------------------------------------
 */

import { loadEmotionModel, isModelReady } from "./modelLoader.js";
import { classifyEmotion } from "./emotionClassifier.js";
import { getSuggestions, getSuggestionCount } from "./suggestionManager.js";
import {
  requestNotificationPermission,
  scheduleReminder,
  unscheduleReminder,
  setSchedule,
} from "./notificationHelper.js";
import {
  saveMemory,
  getHappyMemories,
  deleteMemory,
  updateMemoryFavorite,
  saveJournalEntry,
  saveEmotionResult,
  getJournalEntries,
  getMoodHistory as getMoodHistoryFromDB,
  saveReminder,
  getReminders,
  updateReminderStatus,
  deleteReminder,
  saveUser,
  getUser,
} from "./indexedDB.js";
import { uid } from "./utils.js";
import { logger } from "./logger.js";
import { SUGGESTIONS_PAGE_SIZE } from "./constants.js";

// In-memory session state, mirrored into/hydrated from indexedDB.js so the
// UI has fast synchronous access without a DB round-trip on every render.
const state = {
  initialized: false,
  currentUserId: null,
  lastResult: null, // most recent EmotionResult
  suggestionOffset: 0,
  memoriesCache: [], // populated from getHappyMemories() — real DB now
  flashbackIndex: -1,
  reminders: [],
};

/**
 * Loads the on-device model, requests notification permission, and restores
 * everything the database layer has persisted from previous sessions
 * (memories + reminders), re-arming reminder notifications as needed.
 * Call once on app startup (e.g. on DOMContentLoaded).
 */
export async function initialize() {
  if (state.initialized) return;
  logger.info("Initializing MindGuard AI backend...");

  try {
    await loadEmotionModel();
  } catch (err) {
    // Surface the error to the caller so the UI can show a friendly message,
    // but don't crash the whole backend — suggestions/reminders can still work.
    logger.error("Model failed to load during initialize():", err.message);
  }

  await requestNotificationPermission();

  state.memoriesCache = await getHappyMemories();

  // Resume any reminders that were saved in a previous session.
  state.reminders = await getReminders();
  setSchedule(state.reminders);

  state.initialized = true;
  logger.info("Backend initialized. Model ready:", isModelReady());
}

/**
 * Registers (or looks up) the app's user record.
 * Mirrors the "User Information" responsibility of the database: only
 * userId / fullName / email are ever stored here.
 * @param {{ fullName: string, email: string }} input
 */
export async function registerUser({ fullName, email }) {
  const user = await saveUser({ fullName, email });
  state.currentUserId = user.userId;
  return user;
}

/** Returns the currently active user's stored record, or null if none set. */
export async function getCurrentUser() {
  if (!state.currentUserId) return null;
  return getUser(state.currentUserId);
}

/**
 * Runs on-device emotion analysis on journal text.
 * Mirrors script.js's analyzeEmotion() responsibility.
 *
 * result.key is one of the exact same 6 keys the frontend already uses
 * (happy/sad/angry/anxiety/calm/lonely) — no mapping/conversion applied.
 *
 * @param {string} text
 * @returns {Promise<object>} { result: EmotionResult, suggestions: string[] }
 */
export async function analyzeEmotion(text) {
  const result = await classifyEmotion(text);
  state.lastResult = result;
  state.suggestionOffset = 0;

  // Persist to the database layer. Note the DB only ever stores what the AI
  // already decided (result.key) — it does not re-derive or judge it.
  const [date, time] = [
    new Date(result.analyzedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
    new Date(result.analyzedAt).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  ];
  await saveJournalEntry({ text, date, time, userId: state.currentUserId });
  await saveEmotionResult({ emotion: result.key, date, time, userId: state.currentUserId });

  const suggestions = getSuggestions(result.key, 0);

  return { result, suggestions };
}

/** Returns all saved journal entries for the current user, newest first. */
export async function getJournalHistory() {
  return getJournalEntries(state.currentUserId);
}

/** Returns (date, emotion) pairs for the mood-history display, oldest first. */
export async function getMoodHistory() {
  return getMoodHistoryFromDB(state.currentUserId);
}

/**
 * Returns the next page of suggestions for the last-analyzed emotion.
 * Mirrors script.js's showMoreSuggestions().
 */
export function showMoreSuggestions() {
  if (!state.lastResult) {
    logger.warn("showMoreSuggestions() called with no prior analysis.");
    return [];
  }
  state.suggestionOffset =
    (state.suggestionOffset + SUGGESTIONS_PAGE_SIZE) %
    getSuggestionCount(state.lastResult.key);
  return getSuggestions(state.lastResult.key, state.suggestionOffset);
}

/**
 * Saves the currently analyzed journal entry as a happy memory.
 * Mirrors script.js's saveCurrentAsMemory(). Persists via the real
 * IndexedDB-backed database layer (indexedDB.js).
 *
 * @param {string} text
 */
export async function saveCurrentAsMemory(text) {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  const saved = await saveMemory({ text, date: dateStr });
  // saveMemory() already returns a real generated id from the database, but
  // fall back to a locally generated one defensively in case it doesn't.
  const memory = { ...saved, id: saved.id ?? uid("mem"), favorite: false };
  state.memoriesCache.unshift(memory);
  return memory;
}

/** Returns a random happy memory. Mirrors script.js's showHappyMemory(). */
export function showHappyMemory() {
  if (state.memoriesCache.length === 0) return null;
  state.flashbackIndex = Math.floor(Math.random() * state.memoriesCache.length);
  return state.memoriesCache[state.flashbackIndex];
}

/** Moves the flashback cursor forward/backward. Mirrors script.js's flashbackNav(). */
export function flashbackNav(direction) {
  if (state.memoriesCache.length === 0 || state.flashbackIndex === -1) return null;
  const len = state.memoriesCache.length;
  state.flashbackIndex = (state.flashbackIndex + direction + len) % len;
  return state.memoriesCache[state.flashbackIndex];
}

/** Toggles favorite on the currently shown flashback memory (persisted to DB). */
export async function flashbackFavorite() {
  if (state.flashbackIndex === -1) return null;
  const memory = state.memoriesCache[state.flashbackIndex];
  memory.favorite = !memory.favorite;
  await updateMemoryFavorite(memory.id, memory.favorite);
  return memory;
}

/** Deletes a memory by id (persisted via the database layer). */
export async function removeMemory(id) {
  await deleteMemory(id);
  state.memoriesCache = state.memoriesCache.filter((m) => m.id !== id);
}

/** Full in-memory list of loaded memories, for screens that render a list (not just the flashback). */
export function getMemoryList() {
  return state.memoriesCache;
}

/** Toggles favorite on a memory by id (any memory, not just the current flashback one). */
export async function toggleMemoryFavorite(id) {
  const memory = state.memoriesCache.find((m) => m.id === id);
  if (!memory) return null;
  memory.favorite = !memory.favorite;
  await updateMemoryFavorite(id, memory.favorite);
  return memory;
}

/** Full in-memory list of loaded reminders, for the Reminders screen. */
export function getReminderList() {
  return state.reminders;
}

/**
 * Registers a reminder, persists it to the database, and schedules its
 * native notification. Mirrors script.js's addReminder().
 *
 * @param {{ message: string, date: string, time: string, notify: boolean }} input
 */
export async function addReminder(input) {
  const enabled = input.notify ?? true;
  const saved = await saveReminder({
    message: input.message,
    date: input.date,
    time: input.time,
    enabled,
    userId: state.currentUserId,
  });
  state.reminders.push(saved);
  scheduleReminder(saved);
  return saved;
}

/** Removes a reminder from the database and cancels its scheduled notification. */
export async function removeReminder(id) {
  state.reminders = state.reminders.filter((r) => r.id !== id);
  unscheduleReminder(id);
  await deleteReminder(id);
}

/** Enables/disables an existing reminder (persisted) without deleting it. */
export async function toggleReminder(id, enabled) {
  const updated = await updateReminderStatus(id, enabled);
  state.reminders = state.reminders.map((r) => (r.id === id ? updated : r));
  if (enabled) {
    scheduleReminder(updated);
  } else {
    unscheduleReminder(id);
  }
  return updated;
}

/** Read-only snapshot of current backend state, useful for debugging. */
export function getState() {
  return {
    initialized: state.initialized,
    modelReady: isModelReady(),
    lastResult: state.lastResult,
    memoriesCount: state.memoriesCache.length,
    remindersCount: state.reminders.length,
  };
}
