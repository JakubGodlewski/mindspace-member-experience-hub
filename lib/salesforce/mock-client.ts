
import mockResponse from "../mocks/salesforce-feedback-query-response.json";
import type {
  SalesforceClient,
  SalesforceCaseCreateRequest,
  SalesforceCreateResponse,
} from "./client";
import type {
  SalesforceFeedbackRecord,
  SalesforceQueryResponse,
} from "./types";

interface MockStore {
  feedback: SalesforceFeedbackRecord[];
  caseCounter: number;
}

// createSalesforceClient() returns a new instance per call, so the mock
// state lives at module level and persists for the server process lifetime.
let store: MockStore | null = null;

function getStore(): MockStore {
  if (!store) {
    const seed = mockResponse as SalesforceQueryResponse<
      SalesforceFeedbackRecord
    >;

    store = {
      feedback: structuredClone(seed.records),
      caseCounter: 0,
    };
  }

  return store;
}

export class MockSalesforceClient implements SalesforceClient {
  async queryFeedback(): Promise<
    SalesforceQueryResponse<SalesforceFeedbackRecord>
  > {
    const records = structuredClone(getStore().feedback);

    return {
      totalSize: records.length,
      done: true,
      records,
    };
  }

  async createCase(
    request: SalesforceCaseCreateRequest
  ): Promise<SalesforceCreateResponse> {
    if (!request.Subject || !request.ContactId) {
      return {
        id: "",
        success: false,
        errors: ["REQUIRED_FIELD_MISSING"],
      };
    }

    const state = getStore();
    state.caseCounter += 1;

    return {
      id: `500${String(state.caseCounter).padStart(12, "0")}AAA`,
      success: true,
      errors: [],
    };
  }

  async updateFeedbackCase(
    feedbackId: string,
    caseId: string
  ): Promise<void> {
    const state = getStore();
    const record = state.feedback.find((item) => item.Id === feedbackId);

    if (!record) {
      throw new Error("FEEDBACK_NOT_FOUND");
    }

    record.Case__c = caseId;
    record.Case__r = {
      attributes: {
        type: "Case",
        url: `/services/data/v66.0/sobjects/Case/${caseId}`,
      },
      CaseNumber: String(state.caseCounter).padStart(8, "0"),
    };
  }
}
