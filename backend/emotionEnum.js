/**
 * emotionEnum.js
 * ---------------------------------------------------------------------------
 * Single source of truth for the emotions the on-device model classifies.
 *
 * These 6 classes match the existing frontend's `EMOTIONS` object in
 * script.js exactly — same keys, no mapping or conversion layer anywhere in
 * the backend. The model's output layer must have exactly 6 units
 * corresponding 1:1, in this order, to EMOTION_CLASSES below (see
 * modelLoader.js / emotionClassifier.js).
 * ---------------------------------------------------------------------------
 */

export const EMOTION_CLASSES = Object.freeze([
  "happy",
  "sad",
  "angry",
  "anxiety",
  "calm",
  "lonely",
]);

export const EMOTION_META = Object.freeze({
  happy: {
    label: "Happy",
    emoji: "😊",
    explain:
      "Your words carry a light, upbeat energy — something today seems to be going right.",
  },
  sad: {
    label: "Sad",
    emoji: "😔",
    explain:
      "There's a heaviness in what you wrote. It's okay to sit with this — you don't have to fix it right away.",
  },
  angry: {
    label: "Angry",
    emoji: "😡",
    explain:
      "Your entry shows some frustration. Giving it space instead of pushing it down can help it pass more gently.",
  },
  anxiety: {
    label: "Anxiety",
    emoji: "😰",
    explain:
      "There's a sense of worry running through your words. Grounding yourself in the present moment may help ease it.",
  },
  calm: {
    label: "Calm",
    emoji: "😌",
    explain:
      "You sound settled and at ease right now. A great moment to notice what's working and hold onto it.",
  },
  lonely: {
    label: "Lonely",
    emoji: "😞",
    explain:
      "It sounds like you could use some connection right now. Reaching out, even briefly, can make a real difference.",
  },
});

/**
 * Type-check helper. Throws if the given key isn't a known model class —
 * fail loudly rather than silently mis-rendering an unknown emotion.
 */
export function assertValidEmotion(key) {
  if (!EMOTION_CLASSES.includes(key)) {
    throw new Error(`Unknown emotion class: "${key}"`);
  }
}
