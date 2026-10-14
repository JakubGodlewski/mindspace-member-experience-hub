
import type { MemberFeedback } from "../types";
import type { SalesforceFeedbackRecord } from "./types";

export function mapFeedback(
  record: SalesforceFeedbackRecord
): MemberFeedback {
  return {
    id: record.Id,
    contactId: record.Contact__c,
    contactName: record.Contact__r?.Name ?? "Unknown",
    accountName: record.Contact__r?.Account?.Name ?? "Unknown",
    location: record.Location__c,
    score: record.Rating__c,
    category: record.Category__c,
    comment: record.Comment__c,
    submittedAt: record.Submitted_At__c,
    caseId: record.Case__c,
    caseNumber: record.Case__r?.CaseNumber ?? null,
  };
}
