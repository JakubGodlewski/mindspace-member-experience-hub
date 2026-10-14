import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SalesforceFeedbackRecord } from "./types";

const { fakeClient } = vi.hoisted(() => ({
  fakeClient: {
    queryFeedback: vi.fn(),
    createCase: vi.fn(),
    updateFeedbackCase: vi.fn(),
    clearFeedbackCases: vi.fn(),
  },
}));

vi.mock("./client-factory", () => ({
  createSalesforceClient: () => fakeClient,
}));

import { createCaseFromFeedback, resetDemoData } from "./feedback-service";

function buildFeedbackRecord(
  overrides: Partial<SalesforceFeedbackRecord> = {}
): SalesforceFeedbackRecord {
  return {
    attributes: {
      type: "Member_Feedback__c",
      url: "/services/data/v66.0/sobjects/Member_Feedback__c/a01000000000001AAA",
    },
    Id: "a01000000000001AAA",
    Name: "SURV-001",
    Contact__c: "003000000000001AAA",
    Contact__r: null,
    Location__c: "Warsaw",
    Rating__c: 1,
    Category__c: "Support",
    Comment__c: "Terrible experience.",
    Submitted_At__c: "2026-10-14T13:15:00.000+0000",
    Case__c: null,
    Case__r: null,
    ...overrides,
  };
}

function givenFeedback(records: SalesforceFeedbackRecord[]) {
  fakeClient.queryFeedback.mockResolvedValue({
    totalSize: records.length,
    done: true,
    records,
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  fakeClient.createCase.mockResolvedValue({
    id: "500000000000001AAA",
    success: true,
    errors: [],
  });
  fakeClient.updateFeedbackCase.mockResolvedValue({ caseNumber: "00000001" });
  fakeClient.clearFeedbackCases.mockResolvedValue(undefined);
});

describe("createCaseFromFeedback", () => {
  it("throws FEEDBACK_NOT_FOUND for an unknown feedback id", async () => {
    givenFeedback([buildFeedbackRecord()]);

    await expect(
      createCaseFromFeedback("a01999999999999AAA")
    ).rejects.toThrow("FEEDBACK_NOT_FOUND");

    expect(fakeClient.createCase).not.toHaveBeenCalled();
  });

  it("throws FEEDBACK_NOT_NEGATIVE for feedback rated above 2", async () => {
    const feedback = buildFeedbackRecord({ Rating__c: 3 });
    givenFeedback([feedback]);

    await expect(createCaseFromFeedback(feedback.Id)).rejects.toThrow(
      "FEEDBACK_NOT_NEGATIVE"
    );

    expect(fakeClient.createCase).not.toHaveBeenCalled();
  });

  it("throws CASE_ALREADY_EXISTS when the feedback already has a Case", async () => {
    const feedback = buildFeedbackRecord({
      Case__c: "500000000000009AAA",
    });
    givenFeedback([feedback]);

    await expect(createCaseFromFeedback(feedback.Id)).rejects.toThrow(
      "CASE_ALREADY_EXISTS"
    );

    expect(fakeClient.createCase).not.toHaveBeenCalled();
  });

  it("throws CONTACT_NOT_FOUND when the feedback has no Contact", async () => {
    const feedback = buildFeedbackRecord({ Contact__c: null });
    givenFeedback([feedback]);

    await expect(createCaseFromFeedback(feedback.Id)).rejects.toThrow(
      "CONTACT_NOT_FOUND"
    );

    expect(fakeClient.createCase).not.toHaveBeenCalled();
  });

  it("throws SALESFORCE_CREATE_FAILED with formatted error details when Case creation fails", async () => {
    const feedback = buildFeedbackRecord();
    givenFeedback([feedback]);

    fakeClient.createCase.mockResolvedValue({
      id: "",
      success: false,
      errors: [
        {
          message: "Required fields are missing: [Subject]",
          errorCode: "REQUIRED_FIELD_MISSING",
          fields: ["Subject"],
        },
        {
          message: "Operation too large",
          errorCode: "LIMIT_EXCEEDED",
          fields: [],
        },
      ],
    });

    await expect(createCaseFromFeedback(feedback.Id)).rejects.toThrow(
      "SALESFORCE_CREATE_FAILED: Required fields are missing: [Subject] (REQUIRED_FIELD_MISSING; fields: Subject); Operation too large (LIMIT_EXCEEDED)"
    );

    expect(fakeClient.updateFeedbackCase).not.toHaveBeenCalled();
  });

  it("creates a Case and links it back to the feedback", async () => {
    const feedback = buildFeedbackRecord({
      Rating__c: 2,
      Category__c: "Billing",
      Comment__c: "Charged twice.",
    });
    givenFeedback([feedback]);

    fakeClient.createCase.mockResolvedValue({
      id: "500000000000042AAA",
      success: true,
      errors: [],
    });
    fakeClient.updateFeedbackCase.mockResolvedValue({
      caseNumber: "00000042",
    });

    const result = await createCaseFromFeedback(feedback.Id);

    expect(fakeClient.createCase).toHaveBeenCalledWith({
      Subject: "Negative feedback - Billing",
      Description: "Charged twice.",
      Origin: "Member Survey",
      Status: "New",
      ContactId: "003000000000001AAA",
    });

    expect(fakeClient.updateFeedbackCase).toHaveBeenCalledWith(
      feedback.Id,
      "500000000000042AAA"
    );

    expect(result).toEqual({
      feedbackId: feedback.Id,
      caseId: "500000000000042AAA",
      caseNumber: "00000042",
      success: true,
    });
  });
});

describe("resetDemoData", () => {
  it("clears all feedback-to-Case links via the client", async () => {
    await resetDemoData();

    expect(fakeClient.clearFeedbackCases).toHaveBeenCalledTimes(1);
  });
});
