import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockSalesforceClient as MockSalesforceClientType } from "./mock-client";

// Fake Redis reproducing the @vercel/kv return values used by the mock:
// incr -> the new counter value, set -> "OK" (null when NX fails),
// mget -> array of values or nulls, get -> value or null.
const { kvFake, redisState } = vi.hoisted(() => {
  const redisState = {
    counters: new Map<string, number>(),
    values: new Map<string, unknown>(),
  };

  const kvFake = {
    incr: vi.fn(async (key: string) => {
      const next = (redisState.counters.get(key) ?? 0) + 1;
      redisState.counters.set(key, next);
      return next;
    }),
    set: vi.fn(
      async (key: string, value: unknown, options?: { nx?: boolean }) => {
        if (options?.nx && redisState.values.has(key)) {
          return null;
        }
        redisState.values.set(key, value);
        return "OK";
      }
    ),
    get: vi.fn(async (key: string) => redisState.values.get(key) ?? null),
    mget: vi.fn(async (...keys: string[]) =>
      keys.map((key) => redisState.values.get(key) ?? null)
    ),
  };

  return { kvFake, redisState };
});

vi.mock("@vercel/kv", () => ({ kv: kvFake }));

const validCaseRequest = {
  Subject: "Negative feedback - Support",
  Description: "Terrible experience.",
  Origin: "Member Survey",
  Status: "New",
  ContactId: "003000000000001AAA",
};

describe("MockSalesforceClient (in-memory)", () => {
  let MockSalesforceClient: new () => MockSalesforceClientType;

  beforeEach(async () => {
    vi.resetModules();
    // Exercise the in-memory backend, never real KV.
    delete process.env.KV_REST_API_URL;
    delete (globalThis as { __mockSalesforceState?: unknown })
      .__mockSalesforceState;
    ({ MockSalesforceClient } = await import("./mock-client"));
  });

  describe("createCase", () => {
    it("returns a unique id for every created Case", async () => {
      const client = new MockSalesforceClient();

      const first = await client.createCase(validCaseRequest);
      const second = await client.createCase(validCaseRequest);

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(first.id).not.toBe(second.id);
    });

    it("fails when Subject is missing", async () => {
      const client = new MockSalesforceClient();

      const result = await client.createCase({
        ...validCaseRequest,
        Subject: "",
      });

      expect(result).toEqual({
        id: "",
        success: false,
        errors: [
          {
            message: "Required fields are missing: [Subject]",
            errorCode: "REQUIRED_FIELD_MISSING",
            fields: ["Subject"],
          },
        ],
      });
    });

    it("fails when ContactId is missing", async () => {
      const client = new MockSalesforceClient();

      const result = await client.createCase({
        ...validCaseRequest,
        ContactId: "",
      });

      expect(result).toEqual({
        id: "",
        success: false,
        errors: [
          {
            message: "Required fields are missing: [ContactId]",
            errorCode: "REQUIRED_FIELD_MISSING",
            fields: ["ContactId"],
          },
        ],
      });
    });
  });

  describe("updateFeedbackCase", () => {
    it("persists the Case link so later queries see it", async () => {
      const client = new MockSalesforceClient();
      const { records } = await client.queryFeedback();
      const feedback = records[0];

      expect(feedback.Case__c).toBeNull();

      const created = await client.createCase(validCaseRequest);
      await client.updateFeedbackCase(feedback.Id, created.id);

      // A new client instance must see the same state,
      // because the factory creates one per request.
      const anotherClient = new MockSalesforceClient();
      const updated = await anotherClient.queryFeedback();
      const record = updated.records.find((r) => r.Id === feedback.Id);

      expect(record?.Case__c).toBe(created.id);
      expect(record?.Case__r?.CaseNumber).toBeTruthy();
    });

    it("throws FEEDBACK_NOT_FOUND for an unknown feedback id", async () => {
      const client = new MockSalesforceClient();

      await expect(
        client.updateFeedbackCase("a01999999999999AAA", "500000000000001AAA")
      ).rejects.toThrow("FEEDBACK_NOT_FOUND");
    });

    it("rejects a second Case for the same feedback (atomic guard)", async () => {
      const client = new MockSalesforceClient();
      const { records } = await client.queryFeedback();
      const feedbackId = records[0].Id;

      await client.updateFeedbackCase(feedbackId, "500000000000001AAA");

      await expect(
        client.updateFeedbackCase(feedbackId, "500000000000002AAA")
      ).rejects.toThrow("CASE_ALREADY_EXISTS");

      const { records: after } = await client.queryFeedback();
      expect(
        after.find((r) => r.Id === feedbackId)?.Case__c
      ).toBe("500000000000001AAA");
    });
  });

  describe("queryFeedback", () => {
    it("returns a snapshot that cannot mutate the store", async () => {
      const client = new MockSalesforceClient();
      const first = await client.queryFeedback();

      first.records[0].Case__c = "tampered";

      const second = await client.queryFeedback();
      expect(second.records[0].Case__c).toBeNull();
    });
  });
});

describe("MockSalesforceClient (Vercel KV)", () => {
  let MockSalesforceClient: new () => MockSalesforceClientType;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    redisState.counters.clear();
    redisState.values.clear();
    process.env.KV_REST_API_URL = "https://kv.example.test";
    ({ MockSalesforceClient } = await import("./mock-client"));
  });

  afterEach(() => {
    delete process.env.KV_REST_API_URL;
  });

  it("generates unique sequential Case IDs via Redis INCR", async () => {
    const client = new MockSalesforceClient();

    const first = await client.createCase(validCaseRequest);
    const second = await client.createCase(validCaseRequest);

    expect(first.id).toBe("500000000000001AAA");
    expect(second.id).toBe("500000000000002AAA");
    expect(kvFake.incr).toHaveBeenCalledTimes(2);
    expect(kvFake.incr).toHaveBeenCalledWith("mindspace:mock:case-counter");
  });

  it("SET NX prevents overwriting an existing feedback-to-Case link", async () => {
    const client = new MockSalesforceClient();
    const { records } = await client.queryFeedback();
    const feedbackId = records[0].Id;

    await client.updateFeedbackCase(feedbackId, "500000000000001AAA");

    expect(kvFake.set).toHaveBeenCalledWith(
      `mindspace:mock:case:${feedbackId}`,
      { caseId: "500000000000001AAA", caseNumber: "00000001" },
      { nx: true }
    );

    await expect(
      client.updateFeedbackCase(feedbackId, "500000000000002AAA")
    ).rejects.toThrow("CASE_ALREADY_EXISTS");

    // The original link is intact in the fake store.
    expect(redisState.values.get(`mindspace:mock:case:${feedbackId}`)).toEqual({
      caseId: "500000000000001AAA",
      caseNumber: "00000001",
    });
  });

  it("queryFeedback merges persisted Case links with the seed records", async () => {
    const client = new MockSalesforceClient();
    const { records } = await client.queryFeedback();
    const target = records[0];

    await client.updateFeedbackCase(target.Id, "500000000000007AAA");

    const { records: merged } = await client.queryFeedback();
    const linked = merged.find((record) => record.Id === target.Id);

    expect(kvFake.mget).toHaveBeenCalled();
    expect(linked?.Case__c).toBe("500000000000007AAA");
    expect(linked?.Case__r?.CaseNumber).toBe("00000007");
    // The remaining records stay untouched.
    expect(merged.filter((record) => record.Case__c)).toHaveLength(1);
  });

  it("a new client instance retrieves persisted Case associations", async () => {
    const first = new MockSalesforceClient();
    const { records } = await first.queryFeedback();
    const feedbackId = records[0].Id;

    await first.updateFeedbackCase(feedbackId, "500000000000003AAA");

    const second = new MockSalesforceClient();
    const { records: after } = await second.queryFeedback();

    expect(after.find((record) => record.Id === feedbackId)?.Case__c).toBe(
      "500000000000003AAA"
    );
  });

  it("the fake reproduces kv return values (incr/set/mget)", async () => {
    expect(await kvFake.incr("counter")).toBe(1);
    expect(await kvFake.incr("counter")).toBe(2);
    expect(await kvFake.set("key", { a: 1 }, { nx: true })).toBe("OK");
    expect(await kvFake.set("key", { a: 2 }, { nx: true })).toBeNull();
    expect(await kvFake.mget("key", "missing")).toEqual([{ a: 1 }, null]);
  });
});
