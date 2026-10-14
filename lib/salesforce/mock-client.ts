
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

// Store lives on globalThis: in dev, Turbopack re-instantiates modules
// (HMR, per-route graphs, dynamic import()), which would silently reset
// plain module-level state. A global survives for the process lifetime.
const globalForMock = globalThis as unknown as {
  __mockSalesforceStore?: MockStore;
};

function getStore(): MockStore {
  if (!globalForMock.__mockSalesforceStore) {
    const seed = mockResponse as SalesforceQueryResponse<
      SalesforceFeedbackRecord
    >;

    globalForMock.__mockSalesforceStore = {
      feedback: structuredClone(seed.records),
      caseCounter: 0,
    };
  }

  return globalForMock.__mockSalesforceStore;
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
    const missingFields = [
      ...(request.Subject ? [] : ["Subject"]),
      ...(request.ContactId ? [] : ["ContactId"]),
    ];

    if (missingFields.length > 0) {
      return {
        id: "",
        success: false,
        errors: [
          {
            message: `Required fields are missing: [${missingFields.join(", ")}]`,
            errorCode: "REQUIRED_FIELD_MISSING",
            fields: missingFields,
          },
        ],
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
