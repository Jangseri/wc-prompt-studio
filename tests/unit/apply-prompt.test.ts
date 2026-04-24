import { describe, it, expect, vi } from "vitest";
import type { PoolConnection } from "mysql2/promise";
import {
  applyPromptTransaction,
  ExistingPromptsError,
} from "@/lib/apply-prompt";
import { CHANNEL_CODES, SIBLING_PRMT_CDS } from "@/lib/prompt-codes";
import { SIBLING_DEFAULTS } from "@/lib/sibling-defaults";

interface ExecuteCall {
  sql: string;
  values: unknown[];
}

function makeMockConn(
  executeImpl: (sql: string, values: unknown[]) => unknown
): { conn: PoolConnection; calls: ExecuteCall[]; begins: number; commits: number; rollbacks: number } {
  const calls: ExecuteCall[] = [];
  let begins = 0;
  let commits = 0;
  let rollbacks = 0;

  const conn = {
    beginTransaction: vi.fn(async () => {
      begins += 1;
    }),
    commit: vi.fn(async () => {
      commits += 1;
    }),
    rollback: vi.fn(async () => {
      rollbacks += 1;
    }),
    execute: vi.fn(async (sql: string, values: unknown[]) => {
      calls.push({ sql, values });
      const out = executeImpl(sql, values);
      return [out, undefined];
    }),
    release: vi.fn(),
  } as unknown as PoolConnection;

  return {
    conn,
    calls,
    get begins() { return begins; },
    get commits() { return commits; },
    get rollbacks() { return rollbacks; },
  } as unknown as {
    conn: PoolConnection;
    calls: ExecuteCall[];
    begins: number;
    commits: number;
    rollbacks: number;
  };
}

describe("applyPromptTransaction — callbot happy path (no existing rows)", () => {
  it("runs begin, pre-check, 4 inserts, 1 lookup, commit; returns main + siblings", async () => {
    let insertIdSeq = 100;
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) {
        return []; // no existing rows
      }
      if (sql.includes("SELECT cstm_id")) {
        return [{ cstm_id: 42 }];
      }
      return { insertId: ++insertIdSeq, affectedRows: 1 };
    });

    const result = await applyPromptTransaction(mock.conn, {
      companySeq: "__TEST__callbot",
      aiStaffSeq: "1",
      channel: "callbot",
      industry: "일반",
      prompt: "serialized prompt body",
    });

    // Sequence: begin → pre-check → main insert → 3 sibling inserts → lookup → commit
    expect((mock.conn.beginTransaction as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect(mock.calls.length).toBe(6); // 1 pre-check + 1 main + 3 siblings + 1 lookup
    expect((mock.conn.commit as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect((mock.conn.rollback as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);

    // Pre-check queries all 4 prmt_cds for this company/staff/channel.
    const checkCall = mock.calls[0];
    expect(checkCall.sql).toContain("SELECT prmt_cd FROM cstm_prmt_info");
    expect(checkCall.values).toEqual([
      "__TEST__callbot",
      "1",
      "SA1000",
      "PD2000",
      ...SIBLING_PRMT_CDS,
    ]);

    // Main insert is plain INSERT (no ON DUPLICATE, no IGNORE)
    const mainCall = mock.calls[1];
    expect(mainCall.sql).toContain("INSERT INTO cstm_prmt_info");
    expect(mainCall.sql).not.toContain("ON DUPLICATE KEY");
    expect(mainCall.sql).not.toContain("IGNORE");
    expect(mainCall.values).toEqual([
      "__TEST__callbot",
      "1",
      "SA1000",
      "PD2000",
      "serialized prompt body",
      null,
    ]);

    // Siblings are also plain INSERTs with SIBLING_DEFAULTS payload
    for (let i = 0; i < 3; i++) {
      const sibPrmt = SIBLING_PRMT_CDS[i];
      const sibCall = mock.calls[i + 2];
      expect(sibCall.sql).toContain("INSERT INTO cstm_prmt_info");
      expect(sibCall.sql).not.toContain("IGNORE");
      expect(sibCall.sql).not.toContain("ON DUPLICATE KEY");
      expect(sibCall.values).toEqual([
        "__TEST__callbot",
        "1",
        "SA1000",
        sibPrmt,
        SIBLING_DEFAULTS[sibPrmt].prompt,
        SIBLING_DEFAULTS[sibPrmt].json_schema,
      ]);
    }

    // Result shape
    expect(result.main).toEqual({ svc_cd: "SA1000", prmt_cd: "PD2000", cstm_id: 42 });
    expect(result.siblings).toHaveLength(3);
    for (const s of result.siblings) {
      expect(s.created).toBe(true);
      expect(typeof s.cstm_id).toBe("number");
    }
  });
});

describe("applyPromptTransaction — industry-specific svc_cd override", () => {
  it("callbot + 병원 → uses SA1200 for main and all siblings", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) return [];
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 1 }];
      return { insertId: 1, affectedRows: 1 };
    });

    const result = await applyPromptTransaction(mock.conn, {
      companySeq: "HOSP",
      aiStaffSeq: "1",
      channel: "callbot",
      industry: "병원",
      prompt: "x",
    });

    // Pre-check targets SA1200
    expect(mock.calls[0].values[2]).toBe("SA1200");
    // Main INSERT uses SA1200
    expect(mock.calls[1].values[2]).toBe("SA1200");
    // All 3 siblings inherit the same svc_cd
    for (let i = 0; i < 3; i++) {
      expect(mock.calls[i + 2].values[2]).toBe("SA1200");
    }
    // Lookup uses SA1200 too
    expect(mock.calls[5].values[2]).toBe("SA1200");
    expect(result.main.svc_cd).toBe("SA1200");
    expect(result.main.prmt_cd).toBe("PD2000");
  });

  it("chatbot + 병원 → stays on SA2000 (no chatbot hospital override)", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) return [];
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 1 }];
      return { insertId: 1, affectedRows: 1 };
    });

    await applyPromptTransaction(mock.conn, {
      companySeq: "HOSP",
      aiStaffSeq: "1",
      channel: "chatbot",
      industry: "병원",
      prompt: "x",
    });

    expect(mock.calls[1].values[2]).toBe("SA2000");
    expect(mock.calls[1].values[3]).toBe("PD0000");
  });

  it("callbot + 일반 → uses SA1000 (default, no override)", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) return [];
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 1 }];
      return { insertId: 1, affectedRows: 1 };
    });

    await applyPromptTransaction(mock.conn, {
      companySeq: "X",
      aiStaffSeq: "1",
      channel: "callbot",
      industry: "일반",
      prompt: "x",
    });

    expect(mock.calls[1].values[2]).toBe("SA1000");
  });

  it("callbot + 직접입력한 임의 업종 → uses SA1000 (no override)", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) return [];
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 1 }];
      return { insertId: 1, affectedRows: 1 };
    });

    await applyPromptTransaction(mock.conn, {
      companySeq: "X",
      aiStaffSeq: "1",
      channel: "callbot",
      industry: "카페",
      prompt: "x",
    });

    expect(mock.calls[1].values[2]).toBe("SA1000");
  });
});

describe("applyPromptTransaction — chatbot uses double_response_list json_schema", () => {
  it("passes CHANNEL_CODES.chatbot.json_schema to the main insert", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) return [];
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 7 }];
      return { insertId: 1, affectedRows: 1 };
    });

    await applyPromptTransaction(mock.conn, {
      companySeq: "ACME",
      aiStaffSeq: "2",
      channel: "chatbot",
      industry: "일반",
      prompt: "x",
    });

    // mainCall is now at index 1 (pre-check is index 0)
    const mainCall = mock.calls[1];
    expect(mainCall.values[2]).toBe("SA2000");
    expect(mainCall.values[3]).toBe("PD0000");
    expect(mainCall.values[5]).toBe(CHANNEL_CODES.chatbot.json_schema);
    expect(typeof mainCall.values[5]).toBe("string");
    expect(() => JSON.parse(mainCall.values[5] as string)).not.toThrow();
  });
});

describe("applyPromptTransaction — jsonSchemaOverride", () => {
  it("when override is null, stores null even for chatbot", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) return [];
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 1 }];
      return { insertId: 1, affectedRows: 1 };
    });

    await applyPromptTransaction(mock.conn, {
      companySeq: "A",
      aiStaffSeq: "1",
      channel: "chatbot",
      industry: "일반",
      prompt: "x",
      jsonSchemaOverride: null,
    });

    expect(mock.calls[1].values[5]).toBeNull();
  });

  it("when override is a string, stores that string verbatim", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) return [];
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 1 }];
      return { insertId: 1, affectedRows: 1 };
    });

    const custom = '{"name":"custom"}';
    await applyPromptTransaction(mock.conn, {
      companySeq: "A",
      aiStaffSeq: "1",
      channel: "callbot",
      industry: "일반",
      prompt: "x",
      jsonSchemaOverride: custom,
    });

    expect(mock.calls[1].values[5]).toBe(custom);
  });
});

describe("applyPromptTransaction — rollback on failure", () => {
  it("rolls back when a sibling insert throws and does not commit", async () => {
    let callIndex = 0;
    const mock = makeMockConn((sql) => {
      callIndex += 1;
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) return [];
      if (callIndex === 4) {
        // After pre-check + main + first sibling — fail on second sibling.
        throw new Error("ER_LOCK_DEADLOCK: simulated deadlock");
      }
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 1 }];
      return { insertId: 1, affectedRows: 1 };
    });

    await expect(
      applyPromptTransaction(mock.conn, {
        companySeq: "A",
        aiStaffSeq: "1",
        channel: "callbot",
        industry: "일반",
        prompt: "x",
      })
    ).rejects.toThrow(/simulated deadlock/);

    expect((mock.conn.rollback as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect((mock.conn.commit as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });

  it("rolls back if lookup returns no rows (data integrity guard)", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) return [];
      if (sql.includes("SELECT cstm_id")) return [];
      return { insertId: 1, affectedRows: 1 };
    });

    await expect(
      applyPromptTransaction(mock.conn, {
        companySeq: "A",
        aiStaffSeq: "1",
        channel: "callbot",
        industry: "일반",
        prompt: "x",
      })
    ).rejects.toThrow(/main row lookup/);

    expect((mock.conn.rollback as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect((mock.conn.commit as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });
});

describe("applyPromptTransaction — strict no-overwrite policy", () => {
  it("throws ExistingPromptsError when pre-check finds any existing row, skips inserts", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) {
        return [{ prmt_cd: "PD2000" }]; // main already exists
      }
      return { insertId: 1, affectedRows: 1 };
    });

    await expect(
      applyPromptTransaction(mock.conn, {
        companySeq: "A",
        aiStaffSeq: "1",
        channel: "callbot",
        industry: "일반",
        prompt: "x",
      })
    ).rejects.toThrow(ExistingPromptsError);

    // Only the pre-check ran — no INSERT, no lookup
    expect(mock.calls.length).toBe(1);
    expect(mock.calls[0].sql).toContain("SELECT prmt_cd FROM cstm_prmt_info");
    expect((mock.conn.rollback as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect((mock.conn.commit as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });

  it("surfaces the specific prmt_cds that already exist", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) {
        return [{ prmt_cd: "PD2000" }, { prmt_cd: "PA1000" }];
      }
      return { insertId: 1, affectedRows: 1 };
    });

    let caught: ExistingPromptsError | undefined;
    try {
      await applyPromptTransaction(mock.conn, {
        companySeq: "A",
        aiStaffSeq: "1",
        channel: "callbot",
        industry: "일반",
        prompt: "x",
      });
    } catch (err) {
      caught = err as ExistingPromptsError;
    }
    expect(caught).toBeInstanceOf(ExistingPromptsError);
    expect(caught?.existingPrmtCds).toEqual(["PD2000", "PA1000"]);
  });

  it("converts duplicate-key error during INSERT (race condition) into ExistingPromptsError", async () => {
    let callIndex = 0;
    const mock = makeMockConn((sql) => {
      callIndex += 1;
      if (sql.includes("SELECT prmt_cd FROM cstm_prmt_info")) return [];
      if (callIndex === 2) {
        // Main INSERT races with another session that just inserted.
        const err: Error & { code?: string; errno?: number } = new Error(
          "ER_DUP_ENTRY: Duplicate entry"
        );
        err.code = "ER_DUP_ENTRY";
        err.errno = 1062;
        throw err;
      }
      return { insertId: 1, affectedRows: 1 };
    });

    await expect(
      applyPromptTransaction(mock.conn, {
        companySeq: "A",
        aiStaffSeq: "1",
        channel: "callbot",
        industry: "일반",
        prompt: "x",
      })
    ).rejects.toThrow(ExistingPromptsError);

    expect((mock.conn.rollback as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect((mock.conn.commit as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });
});
