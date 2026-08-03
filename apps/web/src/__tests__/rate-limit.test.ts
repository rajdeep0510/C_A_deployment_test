import { isRateLimited } from "@/lib/rate-limit";

// The limiter uses a module-level Map keyed by string. To keep tests isolated
// we use unique keys per test case and never assert against a shared key's
// internal count.

describe("isRateLimited", () => {
  it("allows the first request for a fresh key", () => {
    expect(isRateLimited("t:first", 5, 60_000)).toBe(false);
  });

  it("allows requests up to the limit", () => {
    const key = `t:up-to-limit-${Date.now()}`;
    expect(isRateLimited(key, 3, 60_000)).toBe(false);
    expect(isRateLimited(key, 3, 60_000)).toBe(false);
    expect(isRateLimited(key, 3, 60_000)).toBe(false);
  });

  it("rejects once the limit is exceeded", () => {
    const key = `t:over-limit-${Date.now()}`;
    expect(isRateLimited(key, 2, 60_000)).toBe(false);
    expect(isRateLimited(key, 2, 60_000)).toBe(false);
    expect(isRateLimited(key, 2, 60_000)).toBe(true);
    expect(isRateLimited(key, 2, 60_000)).toBe(true);
  });

  it("keeps distinct keys independent", () => {
    const a = `t:indep-a-${Date.now()}`;
    const b = `t:indep-b-${Date.now()}`;
    expect(isRateLimited(a, 1, 60_000)).toBe(false);
    expect(isRateLimited(a, 1, 60_000)).toBe(true);
    // b has its own counter and is not limited
    expect(isRateLimited(b, 1, 60_000)).toBe(false);
  });

  it("resets the window after it expires", async () => {
    const key = `t:expiry-${Date.now()}`;
    expect(isRateLimited(key, 1, 30)).toBe(false); // 30ms window
    expect(isRateLimited(key, 1, 30)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(isRateLimited(key, 1, 30)).toBe(false); // fresh window
  });
});
