/**
 * emotionResult.js
 * ---------------------------------------------------------------------------
 * A tiny, framework-free value object describing the outcome of a single
 * emotion-classification run. Keeping this as a plain factory (rather than a
 * class with methods) means it serializes cleanly if it's ever logged,
 * cached, or handed to the teammate's database layer.
 * ---------------------------------------------------------------------------
 */

import { EMOTION_META, assertValidEmotion } from "./emotionEnum.js";
import { LOW_CONFIDENCE_THRESHOLD } from "./constants.js";

/**
 * @param {string} emotionKey  One of EMOTION_CLASSES
 * @param {number} confidence  0-100
 * @param {string} sourceText  The journal text that was analyzed
 * @returns {object} EmotionResult
 */
export function createEmotionResult(emotionKey, confidence, sourceText = "") {
  assertValidEmotion(emotionKey);
  const meta = EMOTION_META[emotionKey];
  const clampedConfidence = Math.max(0, Math.min(100, Math.round(confidence)));

  return {
    key: emotionKey,
    label: meta.label,
    emoji: meta.emoji,
    explain: meta.explain,
    confidence: clampedConfidence,
    isLowConfidence: clampedConfidence < LOW_CONFIDENCE_THRESHOLD,
    analyzedAt: new Date().toISOString(),
    sourceLength: sourceText.length,
  };
}
