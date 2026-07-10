/**
 * emotionClassifier.js
 * ---------------------------------------------------------------------------
 * Turns raw journal text into an EmotionResult using the pretrained
 * on-device model. This is the only module that runs inference and the only
 * place the pretrained model's native labels get translated into this app's
 * 6 classes — everything downstream (emotionEnum.js, suggestionManager.js,
 * backendManager.js) is untouched and still speaks only happy/sad/angry/
 * anxiety/calm/lonely.
 *
 * WHY A MAPPING LAYER EXISTS:
 * No public pretrained model ships this app's exact 6-class taxonomy, so
 * EMOTION_LABEL_MAP below buckets the model's native labels into it. Where
 * several native labels map to the same target class, their scores are
 * summed before picking the winner.
 *
 * KNOWN GAP: the model has no native "lonely" label, so today it can never
 * win on its own. Closing this cleanly means fine-tuning or adding a second
 * signal — see README.md "Improving accuracy" for options.
 * ---------------------------------------------------------------------------
 */

import { loadEmotionModel } from "./modelLoader.js";
import { EMOTION_CLASSES } from "./emotionEnum.js";
import { createEmotionResult } from "./emotionResult.js";
import { logger } from "./logger.js";

// Native model labels -> this app's EMOTION_CLASSES.
// Model: MicahB/emotion_text_classifier (anger/disgust/fear/joy/neutral/
// sadness/surprise). Adjust freely if you swap EMOTION_MODEL_ID.
const EMOTION_LABEL_MAP = Object.freeze({
  joy: "happy",
  surprise: "happy",
  sadness: "sad",
  anger: "angry",
  disgust: "angry",
  fear: "anxiety",
  neutral: "calm",
});

/**
 * Runs on-device inference on a journal entry.
 *
 * @param {string} text  Raw journal text from #journalInput
 * @returns {Promise<object>} EmotionResult (see emotionResult.js)
 */
export async function classifyEmotion(text) {
  if (!text || !text.trim()) {
    throw new Error("classifyEmotion() requires non-empty text.");
  }

  const classifier = await loadEmotionModel();
  const rawScores = await classifier(text, { top_k: null }); // [{ label, score }, ...]

  const bucketed = Object.fromEntries(EMOTION_CLASSES.map((key) => [key, 0]));
  for (const { label, score } of rawScores) {
    const target = EMOTION_LABEL_MAP[label];
    if (target) {
      bucketed[target] += score;
    } else {
      logger.warn(`classifyEmotion: unmapped model label "${label}" ignored.`);
    }
  }

  let bestKey = EMOTION_CLASSES[0];
  for (const key of EMOTION_CLASSES) {
    if (bucketed[key] > bucketed[bestKey]) bestKey = key;
  }

  const confidence = bucketed[bestKey] * 100;

  // bestKey is already one of the frontend's exact EMOTIONS keys
  // (happy/sad/angry/anxiety/calm/lonely) — no further conversion needed.
  return createEmotionResult(bestKey, confidence, text);
}
