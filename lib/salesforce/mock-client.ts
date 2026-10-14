
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

interface CaseLink {
  caseId: string;
  caseNumber: string;
}

// The seed records are immutable; the only mutable state is the case
// counter and the feedbackId -> Case link. Storage backends:
// - Vercel KV when KV_REST_API_URL is set (Vercel runs route handlers as
//   separate serverless functions with no shared memory). Uses atomic
//   primitives: INCR for unique Case ids and SET NX per feedback record,
//   so concurrent requests cannot duplicate ids or Cases.
// - globalThis locally: survives Turbopack module re-instantiation (HMR,
//   per-route graphs) and keeps local dev zero-config.
const KV_CASE_COUNTER_KEY = "mindspace:mock:case-counter";
const KV_CASE_LINK_PREFIX = "mindspace:mock:case:";

const useKv = Boolean(process.env.KV_REST_API_URL);

const seedResponse = mockResponse as SalesforceQueryResponse<
  SalesforceFeedbackRecord
>;

const globalForMock = globalThis as unknown as {
  __mockSalesforceState?: {
    caseCounter: number;
    caseLinks: Record<string, CaseLink>;
  };
};

function getMemoryState() {
  if (!globalForMock.__mockSalesforceState) {
    globalForMock.__mockSalesforceState = { caseCounter: 0, caseLinks: {} };
  }

  return globalForMock.__mockSalesforceState;
}

function formatCaseId(n: number): string {
  return `500${String(n).padStart(12, "0")}AAA`;
}

function caseNumberFromId(caseId: string): string {
  return String(Number(caseId.slice(3, 15))).padStart(8, "0");
}

// Atomic counter: Redis INCR server-side, or a synchronous in-memory
// increment (no await between read and write, so it cannot interleave).
async function nextCaseId(): Promise<string> {
  if (useKv) {
    return formatCaseId(await kv.incr(KV_CASE_COUNTER_KEY));
  }

  const state = getMemoryState();
  state.caseCounter += 1;
  return formatCaseId(state.caseCounter);
}

async function getCaseLinks(): Promise<Record<string, CaseLink>> {
  if (useKv) {
    const ids = seedResponse.records.map((record) => record.Id);
    const values = await kv.mget<(CaseLink | null)[]>(
      ...ids.map((id) => KV_CASE_LINK_PREFIX + id)
    );

    const links: Record<string, CaseLink> = {};
    values.forEach((value, index) => {
      if (value) {
        links[ids[index]] = value;
      }
    });
    return links;
  }

  return { ...getMemoryState().caseLinks };
}

// Returns false when the feedback already has a Case — an atomic guard
// against duplicate creation (SET NX / synchronous check-and-set).
async function trySetCaseLink(
  feedbackId: string,
  link: CaseLink
): Promise<boolean> {
  if (useKv) {
    const result = await kv.set(KV_CASE_LINK_PREFIX + feedbackId, link, {
      nx: true,
    });
    return result === "OK";
  }

  const state = getMemoryState();
  if (state.caseLinks[feedbackId]) {
    return false;
  }
  state.caseLinks[feedbackId] = link;
  return true;
}

export class MockSalesforceClient implements SalesforceClient {
  async queryFeedback(): Promise<
    SalesforceQueryResponse<SalesforceFeedbackRecord>
  > {
    const links = await getCaseLinks();

    const records = seedResponse.records.map((record) => {
      const clone = structuredClone(record);
      const link = links[record.Id];

      if (link) {
        clone.Case__c = link.caseId;
        clone.Case__r = {
          attributes: {
            type: "Case",
            url: `/services/data/v66.0/sobjects/Case/${link.caseId}`,
          },
          CaseNumber: link.caseNumber,
        };
      }

      return clone;
    });

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

    return {
      id: await nextCaseId(),
      success: true,
      errors: [],
    };
  }

  async updateFeedbackCase(
    feedbackId: string,
    caseId: string
  ): Promise<void> {
    const exists = seedResponse.records.some(
      (record) => record.Id === feedbackId
    );

    if (!exists) {
      throw new Error("FEEDBACK_NOT_FOUND");
    }

    const created = await trySetCaseLink(feedbackId, {
      caseId,
      caseNumber: caseNumberFromId(caseId),
    });

    if (!created) {
      throw new Error("CASE_ALREADY_EXISTS");
    }
  }
}
