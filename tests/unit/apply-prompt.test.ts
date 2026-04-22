import { describe, it, expect, vi } from "vitest";
import type { PoolConnection } from "mysql2/promise";
import { applyPromptTransaction } from "@/lib/apply-prompt";
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

describe("applyPromptTransaction — callbot happy path", () => {
  it("runs begin, 4 inserts, 1 lookup, commit; returns main + siblings", async () => {
    let insertIdSeq = 100;
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT cstm_id")) {
        return [{ cstm_id: 42 }];
      }
      return { insertId: ++insertIdSeq, affectedRows: 1 };
    });

    const result = await applyPromptTransaction(mock.conn, {
      companySeq: "__TEST__hospital",
      aiStaffSeq: "1",
      channel: "callbot",
      prompt: "serialized prompt body",
    });

    // Sequence: begin → main insert → 3 sibling inserts → lookup → commit
    expect((mock.conn.beginTransaction as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect(mock.calls.length).toBe(5); // 1 main + 3 siblings + 1 lookup
    expect((mock.conn.commit as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect((mock.conn.rollback as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);

    // Main insert uses SA1000 / PD2000 / null json_schema
    const mainCall = mock.calls[0];
    expect(mainCall.sql).toContain("INSERT INTO cstm_prmt_info");
    expect(mainCall.sql).toContain("ON DUPLICATE KEY UPDATE");
    expect(mainCall.values).toEqual([
      "__TEST__hospital",
      "1",
      "SA1000",
      "PD2000",
      "serialized prompt body",
      null,
    ]);

    // Siblings use SA1000 with each sibling prmt_cd and SIBLING_DEFAULTS payload
    for (let i = 0; i < 3; i++) {
      const sibPrmt = SIBLING_PRMT_CDS[i];
      const sibCall = mock.calls[i + 1];
      expect(sibCall.sql).toContain("INSERT IGNORE");
      expect(sibCall.values).toEqual([
        "__TEST__hospital",
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

describe("applyPromptTransaction — chatbot uses double_response_list json_schema", () => {
  it("passes CHANNEL_CODES.chatbot.json_schema to the main insert", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 7 }];
      return { insertId: 1, affectedRows: 1 };
    });

    await applyPromptTransaction(mock.conn, {
      companySeq: "ACME",
      aiStaffSeq: "2",
      channel: "chatbot",
      prompt: "x",
    });

    const mainCall = mock.calls[0];
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
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 1 }];
      return { insertId: 1, affectedRows: 1 };
    });

    await applyPromptTransaction(mock.conn, {
      companySeq: "A",
      aiStaffSeq: "1",
      channel: "chatbot",
      prompt: "x",
      jsonSchemaOverride: null,
    });

    expect(mock.calls[0].values[5]).toBeNull();
  });

  it("when override is a string, stores that string verbatim", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT cstm_id")) return [{ cstm_id: 1 }];
      return { insertId: 1, affectedRows: 1 };
    });

    const custom = '{"name":"custom"}';
    await applyPromptTransaction(mock.conn, {
      companySeq: "A",
      aiStaffSeq: "1",
      channel: "callbot",
      prompt: "x",
      jsonSchemaOverride: custom,
    });

    expect(mock.calls[0].values[5]).toBe(custom);
  });
});

describe("applyPromptTransaction — rollback on failure", () => {
  it("rolls back when a sibling insert throws and does not commit", async () => {
    let callIndex = 0;
    const mock = makeMockConn((sql) => {
      callIndex += 1;
      if (callIndex === 3) {
        // Third call: second sibling (PA1000). Fail it.
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
        prompt: "x",
      })
    ).rejects.toThrow(/simulated deadlock/);

    expect((mock.conn.rollback as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect((mock.conn.commit as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });

  it("rolls back if lookup returns no rows (data integrity guard)", async () => {
    const mock = makeMockConn((sql) => {
      if (sql.includes("SELECT cstm_id")) return [];
      return { insertId: 1, affectedRows: 1 };
    });

    await expect(
      applyPromptTransaction(mock.conn, {
        companySeq: "A",
        aiStaffSeq: "1",
        channel: "callbot",
        prompt: "x",
      })
    ).rejects.toThrow(/main row lookup/);

    expect((mock.conn.rollback as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect((mock.conn.commit as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });
});
