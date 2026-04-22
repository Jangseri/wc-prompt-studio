import { describe, it, expect, vi, beforeEach } from "vitest";

const executeMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({ execute: executeMock }),
  sanitizeDbError: (err: unknown) => `sanitized: ${(err as Error).message ?? err}`,
}));

import { GET } from "@/app/api/companies/route";

function makeRequest(qs = ""): Request {
  return new Request(`http://localhost/api/companies${qs ? `?${qs}` : ""}`);
}

beforeEach(() => {
  executeMock.mockReset();
});

describe("GET /api/companies", () => {
  it("returns rows with default status='Y' filter applied", async () => {
    executeMock.mockResolvedValue([[
      {
        company_seq: "A001",
        ai_staff_seq: "1",
        svc_cd: "SA1000",
        prmt_cd: "PD2000",
        status: "Y",
        updt_dt: "2026-04-22",
      },
    ]]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);

    const [sql, params] = executeMock.mock.calls[0];
    expect(sql).toMatch(/FROM cstm_prmt_info/);
    expect(sql).toMatch(/ORDER BY updt_dt DESC/);
    expect(params[0]).toBe("Y");
  });

  it("respects explicit status=N filter", async () => {
    executeMock.mockResolvedValue([[]]);
    await GET(makeRequest("status=N"));
    const [, params] = executeMock.mock.calls[0];
    expect(params).toContain("N");
    expect(params).not.toContain("Y");
  });

  it("translates channel=callbot to svc_cd=SA1000", async () => {
    executeMock.mockResolvedValue([[]]);
    await GET(makeRequest("channel=callbot"));
    const [, params] = executeMock.mock.calls[0];
    expect(params).toContain("SA1000");
  });

  it("translates channel=chatbot to svc_cd=SA2000", async () => {
    executeMock.mockResolvedValue([[]]);
    await GET(makeRequest("channel=chatbot"));
    const [, params] = executeMock.mock.calls[0];
    expect(params).toContain("SA2000");
  });

  it("returns 400 for invalid identifier in company_seq", async () => {
    const res = await GET(makeRequest("company_seq=bad%20value"));
    expect(res.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid channel value", async () => {
    const res = await GET(makeRequest("channel=voicebot"));
    expect(res.status).toBe(400);
  });

  it("returns 500 with sanitized error when DB throws", async () => {
    executeMock.mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:3306"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
  });
});
