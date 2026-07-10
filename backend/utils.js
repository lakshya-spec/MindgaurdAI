/**
 * utils.js
 * ---------------------------------------------------------------------------
 * Small, dependency-free helpers shared across the backend. Text
 * tokenization/vectorization used to live here for the old hashing-trick
 * classifier — that's gone now that emotionClassifier.js uses a pretrained
 * Transformers.js pipeline with its own built-in tokenizer, so only the
 * generic helpers remain.
 * ---------------------------------------------------------------------------
 */

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Debounce helper — useful so rapid re-analysis clicks don't overlap. */
export function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

/** Small unique id generator, good enough for in-memory session objects. */
export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
