/**
 * notificationHelper.js
 * ---------------------------------------------------------------------------
 * Wraps the browser's native Notification API to power the Reminders screen.
 * Everything here is local: no push server, no cloud scheduler. Reminders are
 * held in memory and checked on an interval while the tab is open; each due
 * reminder fires a native OS notification via `new Notification(...)`.
 *
 * Persistence of reminders themselves is out of scope for this module (the
 * teammate's database layer will own storage) — this module only owns
 * *scheduling and firing* notifications for whatever reminder objects it's
 * given.
 * ---------------------------------------------------------------------------
 */

import { REMINDER_POLL_INTERVAL_MS } from "./constants.js";
import { logger } from "./logger.js";

let pollTimer = null;
// reminderId -> { id, message, date, time, notify, fired }
const scheduled = new Map();

/** Requests notification permission from the user. Safe to call repeatedly. */
export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") {
    logger.warn("Notification API is not supported in this browser.");
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch (err) {
    // Older browsers use a callback-style API instead of a Promise.
    return new Promise((resolve) => Notification.requestPermission(resolve));
  }
}

/** Fires a single native notification immediately. */
function fireNotification(reminder) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    logger.warn("Skipping notification (not permitted):", reminder.message);
    return;
  }
  new Notification("MindGuard AI", {
    body: reminder.message,
    icon: undefined,
    tag: `mindguard-reminder-${reminder.id}`,
  });
}

/** Registers a reminder object (shape matches the Reminders screen fields). */
export function scheduleReminder(reminder) {
  scheduled.set(reminder.id, { ...reminder, fired: false });
  ensurePolling();
}

/** Removes a reminder from the schedule (mirrors deleteReminder()). */
export function unscheduleReminder(id) {
  scheduled.delete(id);
}

/** Replaces the entire schedule at once, e.g. after an initial load. */
export function setSchedule(reminders) {
  scheduled.clear();
  for (const r of reminders) scheduled.set(r.id, { ...r, fired: false });
  ensurePolling();
}

function ensurePolling() {
  if (pollTimer) return;
  pollTimer = setInterval(checkDueReminders, REMINDER_POLL_INTERVAL_MS);
}

/** Stops the background polling loop (e.g. on page teardown). */
export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function checkDueReminders() {
  const now = Date.now();
  for (const reminder of scheduled.values()) {
    if (reminder.fired || !reminder.notify) continue;
    const dueAt = new Date(`${reminder.date}T${reminder.time}`).getTime();
    if (!Number.isNaN(dueAt) && dueAt <= now) {
      fireNotification(reminder);
      reminder.fired = true;
    }
  }
}
