/**
 * logger.js
 * ---------------------------------------------------------------------------
 * Thin console wrapper so every backend module logs consistently and can be
 * silenced (e.g. for a production build) from one place.
 * ---------------------------------------------------------------------------
 */

import { LOG_NAMESPACE } from "./constants.js";

let isSilenced = false;

export function setSilenced(value) {
  isSilenced = Boolean(value);
}

function format(args) {
  return [LOG_NAMESPACE, ...args];
}

export const logger = {
  info(...args) {
    if (!isSilenced) console.info(...format(args));
  },
  warn(...args) {
    if (!isSilenced) console.warn(...format(args));
  },
  error(...args) {
    if (!isSilenced) console.error(...format(args));
  },
  debug(...args) {
    if (!isSilenced) console.debug(...format(args));
  },
};
