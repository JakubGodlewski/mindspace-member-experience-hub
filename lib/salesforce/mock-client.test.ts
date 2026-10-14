import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MockSalesforceClient as MockSalesforceClientType } from "./mock-client";

let MockSalesforceClient: new () => MockSalesforceClientType;

beforeEach(async () => {
  vi.resetModules();
  ({ MockSalesforceClient } = await import("./mock-client"));
});

const validCaseRequest = {
  Subject: "Negative feedback - Support",
  Description: "Terrible experience.",
  Origin: "Member Survey",
  Status: "New",
  ContactId: "003000000000001AAA",
};

describe("MockSalesforceClient", () => {
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
