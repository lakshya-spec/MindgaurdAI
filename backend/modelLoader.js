/**
 * modelLoader.js
 * ---------------------------------------------------------------------------
 * Loads the pretrained on-device emotion model via Transformers.js, which
 * runs it in-browser through ONNX Runtime Web (WASM by default). The model
 * is fetched once from the Hugging Face Hub and cached by the browser —
 * every call after that is fully offline, exactly like this backend's
 * original tf.min.js caching strategy.
 *
 * For a zero-external-request build (no Hub fetch at all, even on first
 * run), see the "Fully offline build" section in README.md — it's a two
 * line change right here.
 * ---------------------------------------------------------------------------
 */

import {
  EMOTION_MODEL_ID,
  EMOTION_MODEL_DTYPE,
  TRANSFORMERS_JS_CDN_URL,
} from "./constants.js";
import { logger } from "./logger.js";

let cachedClassifier = null;
let loadingPromise = null;

/**
 * Loads (or returns the cached) emotion-classification pipeline.
 * Safe to call multiple times — concurrent callers share one load.
 *
 * @returns {Promise<Function>} a callable Transformers.js pipeline:
 *   await classifier(text, { top_k: null }) -> [{ label, score }, ...]
 */
export async function loadEmotionModel() {
  if (cachedClassifier) return cachedClassifier;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const { pipeline, env } = await import(TRANSFORMERS_JS_CDN_URL);

      // --- Fully offline build (optional) ---------------------------------
      // Uncomment these two lines once you've converted + self-hosted the
      // ONNX weights under e.g. /models/emotion/ (see README.md):
      // env.allowRemoteModels = false;
      // env.localModelPath = "/models/";
      // --------------------------------------------------------------------

      logger.info("Loading emotion model:", EMOTION_MODEL_ID);
      const classifier = await pipeline("text-classification", EMOTION_MODEL_ID, {
        dtype: EMOTION_MODEL_DTYPE,
      });

      // Warm up so the first real prediction isn't penalized by lazy
      // WASM/kernel initialization.
      await classifier("warming up");

      cachedClassifier = classifier;
      logger.info("Emotion model loaded and warmed up.");
      return cachedClassifier;
    } catch (err) {
      logger.error("Failed to load emotion model:", err);
      throw new Error(
        `Could not load the on-device emotion model "${EMOTION_MODEL_ID}". ` +
          `Check your network on first load (the model is cached after that), ` +
          `or see README.md for the fully-offline self-hosted setup. ` +
          `Original error: ${err.message}`
      );
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/** True once the model has been successfully loaded into memory. */
export function isModelReady() {
  return cachedClassifier !== null;
}

/** Drops the cached pipeline reference. Mostly useful for hot-reloading. */
export function disposeModel() {
  cachedClassifier = null;
  logger.info("Emotion model reference cleared.");
}
