import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  check,
  getClientIp,
  _resetForTests,
  _setClockForTests,
  _bucketCountForTests,
} from "@/lib/rate-limit";

describe("rate-limit check()", () => {
  beforeEach(() => {
    _resetForTests();
    _setClockForTests(() => 1_000_000);
  });

  afterEach(() => {
    _setClockForTests(undefined);
  });

  it("allows requests up to capacity", () => {
    for (let i = 0; i < 5; i++) {
      const r = check("1.2.3.4", { capacity: 5, refillPerSecond: 1 });
      expect(r.allowed).toBe(true);
    }
  });

  it("denies beyond capacity with a positive resetMs", () => {
    const opts = { capacity: 3, refillPerSecond: 1 };
    for (let i = 0; i < 3; i++) check("5.5.5.5", opts);
    const r = check("5.5.5.5", opts);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetMs).toBeGreaterThan(0);
  });

  it("refills tokens over elapsed time", () => {
    let now = 1_000_000;
    _setClockForTests(() => now);

    const opts = { capacity: 2, refillPerSecond: 1 };
    expect(check("9.9.9.9", opts).allowed).toBe(true);
    expect(check("9.9.9.9", opts).allowed).toBe(true);
    expect(check("9.9.9.9", opts).allowed).toBe(false);

    now += 1500; // 1.5 seconds → +1.5 tokens, capped behavior; 1 token is fully available
    expect(check("9.9.9.9", opts).allowed).toBe(true);
  });

  it("tracks buckets independently per IP", () => {
    const opts = { capacity: 1, refillPerSecond: 0.01 };
    expect(check("10.0.0.1", opts).allowed).toBe(true);
    expect(check("10.0.0.1", opts).allowed).toBe(false);
    expect(check("10.0.0.2", opts).allowed).toBe(true);
  });

  it("counts one bucket per unique ip", () => {
    const opts = { capacity: 1, refillPerSecond: 1 };
    check("a", opts);
    check("b", opts);
    check("a", opts);
    expect(_bucketCountForTests()).toBe(2);
  });
});

describe("getClientIp()", () => {
  it("returns the first entry of x-forwarded-for", () => {
    const req = new Request("http://example.test", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://example.test", {
      headers: { "x-real-ip": "198.51.100.42" },
    });
    expect(getClientIp(req)).toBe("198.51.100.42");
  });

  it("returns 'unknown' when no ip header is present", () => {
    const req = new Request("http://example.test");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("accepts a Headers object directly", () => {
    const h = new Headers({ "x-forwarded-for": "127.0.0.1" });
    expect(getClientIp(h)).toBe("127.0.0.1");
  });
});
