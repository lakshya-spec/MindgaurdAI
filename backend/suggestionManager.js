/**
 * suggestionManager.js
 * ---------------------------------------------------------------------------
 * Predefined, static suggestion lists keyed by the exact same 6 emotion keys
 * the frontend uses (happy/sad/angry/anxiety/calm/lonely) — no mapping or
 * conversion layer. Text matches the frontend's own EMOTIONS suggestion
 * lists in script.js so behavior is identical whether the mock or this real
 * backend is driving the UI. Purely data + pagination logic — no AI involved
 * here by design, which also keeps this instant and fully offline.
 * ---------------------------------------------------------------------------
 */

import { EMOTION_CLASSES, assertValidEmotion } from "./emotionEnum.js";
import { SUGGESTIONS_PAGE_SIZE } from "./constants.js";

const SUGGESTIONS = Object.freeze({
  happy: [
    "🌸 Take a short walk",
    "🎵 Listen to relaxing music",
    "☀️ Spend 10 minutes outside",
    "📖 Read something inspiring",
    "🎨 Try a small creative task",
    "☕ Savor a warm drink slowly",
  ],
  sad: [
    "💧 Drink some water",
    "🎵 Listen to relaxing music",
    "📞 Reach out to someone you trust",
    "🛁 Take a warm shower",
    "📝 Write down one small win today",
    "🌙 Rest a little earlier tonight",
  ],
  angry: [
    "🧘 Deep breathing exercise",
    "🚶 Step outside for fresh air",
    "✍️ Write out what's bothering you",
    "🥤 Drink a cold glass of water",
    "🎧 Play calming instrumental music",
    "⏸️ Pause before responding to anyone",
  ],
  anxiety: [
    "🧘 Deep breathing exercise",
    "🖐️ Try the 5-4-3-2-1 grounding method",
    "💧 Drink some water",
    "🎵 Listen to relaxing music",
    "📵 Take a short break from screens",
    "🕯️ Sit somewhere quiet for a minute",
  ],
  calm: [
    "📖 Read something inspiring",
    "🎵 Listen to relaxing music",
    "☀️ Spend 10 minutes outside",
    "📝 Jot down what's helping today",
    "🌿 Water a plant or tidy a small space",
    "🧘 A few minutes of quiet stretching",
  ],
  lonely: [
    "📞 Message a friend or family member",
    "🐾 Spend time with a pet if you have one",
    "📖 Read something inspiring",
    "🎵 Listen to relaxing music",
    "☀️ Spend 10 minutes outside",
    "✍️ Write a note to your future self",
  ],
});

/**
 * Returns a page of suggestions for the given emotion.
 * @param {string} emotionKey  One of EMOTION_CLASSES
 * @param {number} offset      Starting index (wraps around the list)
 * @param {number} pageSize
 */
export function getSuggestions(
  emotionKey,
  offset = 0,
  pageSize = SUGGESTIONS_PAGE_SIZE
) {
  assertValidEmotion(emotionKey);
  const list = SUGGESTIONS[emotionKey];
  const normalizedOffset = ((offset % list.length) + list.length) % list.length;

  // Wrap around so "Show More" always yields a full page, cycling if needed.
  const page = [];
  for (let i = 0; i < Math.min(pageSize, list.length); i++) {
    page.push(list[(normalizedOffset + i) % list.length]);
  }
  return page;
}

/** Total number of suggestions available for an emotion. */
export function getSuggestionCount(emotionKey) {
  assertValidEmotion(emotionKey);
  return SUGGESTIONS[emotionKey].length;
}

export { EMOTION_CLASSES };
