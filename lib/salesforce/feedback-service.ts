
import { createSalesforceClient } from "./client-factory";

export async function createCaseFromFeedback(
  feedbackId: string
) {
  const client = createSalesforceClient();
  const result = await client.queryFeedback();

  const feedback = result.records.find(
    (record) => record.Id === feedbackId
  );

  if (!feedback) {
    throw new Error("FEEDBACK_NOT_FOUND");
  }

  if (feedback.Rating__c > 2) {
    throw new Error("FEEDBACK_NOT_NEGATIVE");
  }

  if (feedback.Case__c) {
    throw new Error("CASE_ALREADY_EXISTS");
  }

  if (!feedback.Contact__c) {
    throw new Error("CONTACT_NOT_FOUND");
  }

  const caseRequest = {
    Subject: `Negative feedback - ${feedback.Category__c}`,
    Description: feedback.Comment__c,
    Origin: "Member Survey",
    Status: "New",
    ContactId: feedback.Contact__c,
  };

  const response = await client.createCase(caseRequest);

  if (!response.success) {
    throw new Error(
      `SALESFORCE_CREATE_FAILED: ${response.errors.join(", ")}`
    );
  }

  return {
    feedbackId,
    caseId: response.id,
    success: true,
  };
}
