
import { kv } from "@vercel/kv";

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

// Storage backend:
// - Vercel KV when KV_REST_API_URL is set (Vercel runs route handlers as
//   separate serverless functions with no shared memory, so in-process
//   state cannot persist there).
// - globalThis locally: survives Turbopack module re-instantiation (HMR,
//   per-route graphs) and keeps local dev zero-config.
const KV_KEY = "mindspace:mock-salesforce-store";
const useKv = Boolean(process.env.KV_REST_API_URL);

const globalForMock = globalThis as unknown as {
  __mockSalesforceStore?: MockStore;
};

async function loadStore(): Promise<MockStore> {
  if (useKv) {
    const existing = await kv.get<MockStore>(KV_KEY);

    if (existing) {
      return existing;
    }
  } else if (globalForMock.__mockSalesforceStore) {
    return globalForMock.__mockSalesforceStore;
  }

  const seed = mockResponse as SalesforceQueryResponse<
    SalesforceFeedbackRecord
  >;
  const store: MockStore = {
    feedback: structuredClone(seed.records),
    caseCounter: 0,
  };

  await saveStore(store);

  return store;
}

async function saveStore(store: MockStore): Promise<void> {
  if (useKv) {
    await kv.set(KV_KEY, store);
  } else {
    globalForMock.__mockSalesforceStore = store;
  }
}

export class MockSalesforceClient implements SalesforceClient {
  async queryFeedback(): Promise<
    SalesforceQueryResponse<SalesforceFeedbackRecord>
  > {
    const store = await loadStore();
    const records = structuredClone(store.feedback);

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

    const store = await loadStore();
    store.caseCounter += 1;
    await saveStore(store);

    return {
      id: `500${String(store.caseCounter).padStart(12, "0")}AAA`,
      success: true,
      errors: [],
    };
  }

  async updateFeedbackCase(
    feedbackId: string,
    caseId: string
  ): Promise<void> {
    const store = await loadStore();
    const record = store.feedback.find((item) => item.Id === feedbackId);

    if (!record) {
      throw new Error("FEEDBACK_NOT_FOUND");
    }

    record.Case__c = caseId;
    record.Case__r = {
      attributes: {
        type: "Case",
        url: `/services/data/v66.0/sobjects/Case/${caseId}`,
      },
      CaseNumber: String(store.caseCounter).padStart(8, "0"),
    };

    await saveStore(store);
  }
}
