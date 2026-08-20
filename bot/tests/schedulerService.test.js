const assert = require("node:assert/strict");
const scheduler = require("../services/schedulerService");

describe("schedulerService", () => {
  afterEach(() => scheduler.clear());

  it("registers jobs and exposes their state", () => {
    scheduler.register("test", async () => {}, 1000);
    const [job] = scheduler.snapshot();

    assert.equal(job.name, "test");
    assert.equal(job.intervalMs, 1000);
    assert.equal(job.runCount, 0);
    assert.equal(job.running, false);
  });

  it("rejects duplicate names and invalid intervals", () => {
    scheduler.register("test", async () => {}, 1000);
    assert.throws(() => scheduler.register("test", async () => {}, 1000), /Duplicate/);
    assert.throws(() => scheduler.register("bad", async () => {}, 0), /positive interval/);
  });

  it("runs immediate jobs and records successful execution", async () => {
    let calls = 0;
    scheduler.register("test", async () => { calls += 1; }, 60000, { runImmediately: true });
    scheduler.start();

    await new Promise(resolve => setTimeout(resolve, 20));

    const [job] = scheduler.snapshot();
    assert.equal(calls, 1);
    assert.equal(job.runCount, 1);
    assert.equal(job.lastError, null);
  });

  it("contains handler failures without stopping the scheduler", async () => {
    scheduler.register("test", async () => { throw new Error("boom"); }, 60000, { runImmediately: true });
    scheduler.start();

    await new Promise(resolve => setTimeout(resolve, 20));

    const [job] = scheduler.snapshot();
    assert.equal(job.lastError, "boom");
    assert.equal(job.running, false);
  });
});
