/**
 * Centralized scheduler for Nexus background jobs.
 *
 * Jobs are registered once and executed on a fixed interval. The scheduler
 * isolates failures per job so one failing task cannot stop the others.
 */

const logger = require("./logger");

const jobs = new Map();
let started = false;

function register(name, handler, intervalMs, options = {}) {
  if (!name) throw new Error("Scheduled job name is required");
  if (typeof handler !== "function") {
    throw new TypeError(`Scheduled job ${name} requires a function handler`);
  }
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(`Scheduled job ${name} requires a positive interval`);
  }
  if (jobs.has(name)) throw new Error(`Duplicate scheduled job: ${name}`);

  jobs.set(name, {
    name,
    handler,
    intervalMs,
    runImmediately: options.runImmediately === true,
    timer: null,
    running: false,
    lastRunAt: null,
    lastError: null,
    runCount: 0
  });
}

async function run(job) {
  if (job.running) return;
  job.running = true;
  job.lastRunAt = new Date().toISOString();
  job.runCount += 1;

  try {
    await job.handler();
    job.lastError = null;
  } catch (err) {
    job.lastError = err.message;
    logger.error(`[SCHEDULER] ${job.name} failed: ${err.message}`);
  } finally {
    job.running = false;
  }
}

function start() {
  if (started) return;
  started = true;

  for (const job of jobs.values()) {
    if (job.runImmediately) void run(job);
    job.timer = setInterval(() => void run(job), job.intervalMs);
  }

  logger.info(`[SCHEDULER] Started ${jobs.size} scheduled job(s)`);
}

function stop() {
  for (const job of jobs.values()) {
    if (job.timer) clearInterval(job.timer);
    job.timer = null;
  }
  started = false;
}

function snapshot() {
  return [...jobs.values()].map(job => ({
    name: job.name,
    intervalMs: job.intervalMs,
    running: job.running,
    lastRunAt: job.lastRunAt,
    lastError: job.lastError,
    runCount: job.runCount
  }));
}

function clear() {
  stop();
  jobs.clear();
}

module.exports = {
  register,
  start,
  stop,
  snapshot,
  clear
};
