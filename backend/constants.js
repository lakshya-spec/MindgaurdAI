/**
 * constants.js
 * ---------------------------------------------------------------------------
 * Central place for every configurable value used by the MindGuard AI
 * on-device backend. Nothing in here talks to a network at runtime beyond
 * fetching the model itself (once — then the browser caches it). No journal
 * text ever leaves the device.
 * ---------------------------------------------------------------------------
 */

// Hugging Face Hub id of the pretrained emotion-classification model, run
// on-device via Transformers.js (ONNX Runtime Web — WASM/WebGPU, no server).
// This exact model is verified "Transformers.js"-compatible on the Hub:
// https://huggingface.co/MicahB/emotion_text_classifier
// Swap this for any other text-classification model that carries the
// "Transformers.js" library tag on its Hub page — no other code changes
// needed, just update EMOTION_LABEL_MAP in emotionClassifier.js to match
// its label set.
export const EMOTION_MODEL_ID = "MicahB/emotion_text_classifier";

// Weight precision to download/run. "q8" is the Transformers.js default for
// WASM (CPU) execution — a good balance of size and accuracy in-browser.
// Other options: "fp32" (largest, most accurate), "q4" (smallest, fastest).
export const EMOTION_MODEL_DTYPE = "q8";

// Pinned Transformers.js version, loaded as a native ES module straight from
// the CDN (no bundler/npm install required — same "no build step" approach
// this project already uses). Pin it so a library update can't silently
// change behavior; bump deliberately when you want a newer version.
export const TRANSFORMERS_JS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

// Below this confidence (0-100) we still show a result, but flag it as
// low-confidence so the UI/caller can choose to soften the copy if desired.
export const LOW_CONFIDENCE_THRESHOLD = 45;

// How many suggestions are revealed per "Show More Suggestions" click.
export const SUGGESTIONS_PAGE_SIZE = 4;

// Notification lead behavior — how often (ms) the reminder scheduler checks
// for due reminders while the app/tab is open.
export const REMINDER_POLL_INTERVAL_MS = 30 * 1000;

// Namespace prefix for all logger output, so it's easy to filter in devtools.
export const LOG_NAMESPACE = "[MindGuardAI]";
