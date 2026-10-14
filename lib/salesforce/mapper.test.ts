import { describe, expect, it } from "vitest";

import { mapFeedback } from "./mapper";
import type { SalesforceFeedbackRecord } from "./types";

function buildRecord(
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
    Contact__r: {
      attributes: {
        type: "Contact",
        url: "/services/data/v66.0/sobjects/Contact/003000000000001AAA",
      },
      Name: "Natalia Kaminska",
      AccountId: "001000000000030AAA",
      Account: {
        attributes: {
          type: "Account",
          url: "/services/data/v66.0/sobjects/Account/001000000000030AAA",
        },
        Name: "E-Commerce Experts",
      },
    },
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

describe("mapFeedback", () => {
  it("maps the Case ID and Case Number when a Case is linked", () => {
    const record = buildRecord({
      Case__c: "500000000000001AAA",
      Case__r: {
        attributes: {
          type: "Case",
          url: "/services/data/v66.0/sobjects/Case/500000000000001AAA",
        },
        CaseNumber: "00000001",
      },
    });

    const feedback = mapFeedback(record);

    expect(feedback.caseId).toBe("500000000000001AAA");
    expect(feedback.caseNumber).toBe("00000001");
  });

  it("maps null Case fields when no Case is linked", () => {
    const feedback = mapFeedback(buildRecord());

    expect(feedback.caseId).toBeNull();
    expect(feedback.caseNumber).toBeNull();
  });
});
