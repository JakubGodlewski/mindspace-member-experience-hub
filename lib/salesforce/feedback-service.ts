
import { createSalesforceClient } from "./client-factory";
import type { SalesforceError } from "./types";

function formatSalesforceErrors(errors: SalesforceError[]): string {
  if (errors.length === 0) {
    return "Unknown Salesforce error";
  }

  return errors
    .map((error) =>
      error.fields.length > 0
        ? `${error.message} (${error.errorCode}; fields: ${error.fields.join(", ")})`
        : `${error.message} (${error.errorCode})`
    )
    .join("; ");
}

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
      `SALESFORCE_CREATE_FAILED: ${formatSalesforceErrors(response.errors)}`
    );
  }

  await client.updateFeedbackCase(feedbackId, response.id);

  return {
    feedbackId,
    caseId: response.id,
    success: true,
  };
}
