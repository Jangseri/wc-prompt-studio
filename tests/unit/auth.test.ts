import { describe, it, expect } from "vitest";
import { requireSession } from "@/lib/auth";

describe("requireSession (stub)", () => {
  it("returns an anonymous session regardless of request", async () => {
    const result = await requireSession(new Request("http://example.test"));
    expect(result).toEqual({ userId: null, anonymous: true });
  });

  it("returns the same anonymous session shape with auth headers", async () => {
    const req = new Request("http://example.test", {
      headers: { authorization: "Bearer something" },
    });
    const result = await requireSession(req);
    expect(result.anonymous).toBe(true);
    expect(result.userId).toBeNull();
  });
});
