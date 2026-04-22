import { describe, it, expect, vi, beforeEach } from "vitest";

const executeMock = vi.fn();
const releaseMock = vi.fn();
const beginMock = vi.fn();
const commitMock = vi.fn();
const rollbackMock = vi.fn();

const poolExecuteMock = vi.fn();
const getConnectionMock = vi.fn(async () => ({
  execute: executeMock,
  beginTransaction: beginMock,
  commit: commitMock,
  rollback: rollbackMock,
  release: releaseMock,
}));

vi.mock("@/lib/db", () => ({
  getPool: () => ({
    execute: poolExecuteMock,
    getConnection: getConnectionMock,
  }),
  sanitizeDbError: (err: unknown) => `sanitized: ${(err as Error).message ?? err}`,
}));

import { POST } from "@/app/api/prompts/route";
import { _resetForTests as resetRateLimit } from "@/lib/rate-limit";

function makeRequest(body: unknown, ip = "203.0.113.2"): Request {
  return new Request("http://localhost/api/prompts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  executeMock.mockReset();
  releaseMock.mockReset();
  beginMock.mockReset();
  commitMock.mockReset();
  rollbackMock.mockReset();
  poolExecuteMock.mockReset();
  getConnectionMock.mockClear();
  resetRateLimit();
});

describe("POST /api/prompts — input validation", () => {
  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/prompts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.1.1.1" },
      body: "{broken",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeRequest({ company_seq: "A" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for SQL-injection-shaped company_seq", async () => {
    const res = await POST(
      makeRequest({
        company_seq: "x'; DROP TABLE --",
        ai_staff_seq: "1",
        channel: "callbot",
        prompt: "x",
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/prompts — channel path (new, 4-record transaction)", () => {
  it("invokes applyPromptTransaction and returns {main, siblings}", async () => {
    // applyPromptTransaction flow: main insert, 3 sibling inserts, lookup
    executeMock.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT cstm_id")) {
        return [[{ cstm_id: 42 }]];
      }
      if (sql.includes("SELECT *")) {
        return [[
          {
            cstm_id: 42,
            company_seq: "A001",
            ai_staff_seq: "1",
            svc_cd: "SA1000",
            prmt_cd: "PD2000",
            status: "Y",
            prompt: "serialized",
            json_schema: null,
            rgst_dt: "2026-04-22",
            updt_dt: "2026-04-22",
          },
        ]];
      }
      return [{ insertId: 10, affectedRows: 1 }];
    });

    const res = await POST(
      makeRequest({
        company_seq: "A001",
        ai_staff_seq: "1",
        channel: "callbot",
        prompt: "serialized",
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.main.cstm_id).toBe(42);
    expect(body.data.main.svc_cd).toBe("SA1000");
    expect(body.data.siblings).toHaveLength(3);

    // Transaction bookkeeping
    expect(beginMock).toHaveBeenCalledTimes(1);
    expect(commitMock).toHaveBeenCalledTimes(1);
    expect(rollbackMock).toHaveBeenCalledTimes(0);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("rolls back and returns 500 when the transaction throws", async () => {
    executeMock.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT IGNORE")) {
        throw new Error("ER_LOCK_DEADLOCK");
      }
      return [{ insertId: 1, affectedRows: 1 }];
    });

    const res = await POST(
      makeRequest({
        company_seq: "A001",
        ai_staff_seq: "1",
        channel: "chatbot",
        prompt: "x",
      })
    );
    expect(res.status).toBe(500);
    expect(rollbackMock).toHaveBeenCalledTimes(1);
    expect(commitMock).toHaveBeenCalledTimes(0);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/prompts — legacy path (no channel, single insert)", () => {
  it("uses pool.execute once and returns the inserted row", async () => {
    poolExecuteMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "object" && arg !== null && "sql" in arg) {
        return [{ insertId: 77 }];
      }
      // SELECT back
      return [[
        {
          cstm_id: 77,
          company_seq: "B001",
          ai_staff_seq: "2",
          svc_cd: "SA1000",
          prmt_cd: "PD2000",
          status: "Y",
          prompt: "x",
          json_schema: null,
          rgst_dt: "2026-04-22",
          updt_dt: "2026-04-22",
        },
      ]];
    });

    const res = await POST(
      makeRequest({
        company_seq: "B001",
        ai_staff_seq: "2",
        svc_cd: "SA1000",
        prmt_cd: "PD2000",
        prompt: "x",
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.cstm_id).toBe(77);

    // Legacy path should NOT use the transaction connection
    expect(getConnectionMock).not.toHaveBeenCalled();
    expect(beginMock).not.toHaveBeenCalled();
  });
});
