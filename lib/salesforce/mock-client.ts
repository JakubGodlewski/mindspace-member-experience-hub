
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

// The seed records are immutable; the mutable state is the case counter,
// a registry of created Cases (ID -> CaseNumber, mirroring the independent
// Auto Number field on the Case object), and the feedbackId -> Case links.
// Storage backends:
// - Vercel KV when configured (Vercel runs route handlers as separate
//   serverless functions with no shared memory). Redis INCR guarantees
//   unique, sequential Case IDs and SET NX prevents overwriting an
//   existing feedback-to-Case link. These primitives do NOT make the
//   whole create-and-link workflow atomic: two concurrent requests may
//   mint different Case IDs, but only one can establish the association.
//   This limitation is deliberately accepted for a lightweight mock.
// - globalThis locally: survives Turbopack module re-instantiation (HMR,
//   per-route graphs) and keeps local dev zero-config.
const KV_CASE_COUNTER_KEY = "mindspace:mock:case-counter";
const KV_CASE_NUMBERS_KEY = "mindspace:mock:case-numbers";
const KV_CASE_LINK_PREFIX = "mindspace:mock:case:";

// Backend selection. On Vercel (VERCEL=1) both KV variables are required
// — a silent in-memory fallback would lose state between functions.
// A partially configured pair fails fast anywhere, as it is almost always
// a setup mistake. Only variable names appear in errors, never values.
function resolveBackend(): "kv" | "memory" {
  const hasUrl = Boolean(process.env.KV_REST_API_URL);
  const hasToken = Boolean(process.env.KV_REST_API_TOKEN);

  if (hasUrl && hasToken) {
    return "kv";
  }

  if (process.env.VERCEL === "1" || hasUrl !== hasToken) {
    throw new Error(
      "Mock storage misconfiguration: KV_REST_API_URL and KV_REST_API_TOKEN must both be set. They are required when running on Vercel."
    );
  }

  return "memory";
}

const backend = resolveBackend();

const seedResponse = mockResponse as SalesforceQueryResponse<
  SalesforceFeedbackRecord
>;

const globalForMock = globalThis as unknown as {
  __mockSalesforceState?: {
    caseCounter: number;
    caseNumbers: Record<string, string>;
    caseLinks: Record<string, CaseLink>;
  };
};

function getMemoryState() {
  if (!globalForMock.__mockSalesforceState) {
    globalForMock.__mockSalesforceState = {
      caseCounter: 0,
      caseNumbers: {},
      caseLinks: {},
    };
  }

  return globalForMock.__mockSalesforceState;
}

function formatCaseId(n: number): string {
  return `500${String(n).padStart(12, "0")}AAA`;
}

function formatCaseNumber(n: number): string {
  return String(n).padStart(8, "0");
}

// In real Salesforce, CaseNumber is an independent Auto Number field, not
// a value parsed out of the record ID. The mock mirrors this: both
// identifiers come from the same atomic counter value, each produced by
// its own formatter, and the created Case is registered so its number can
// be looked up by ID when linking feedback.
async function registerCase(): Promise<CaseLink> {
  let n: number;

  if (backend === "kv") {
    n = await kv.incr(KV_CASE_COUNTER_KEY);
  } else {
    const state = getMemoryState();
    state.caseCounter += 1;
    n = state.caseCounter;
  }

  const created: CaseLink = {
    caseId: formatCaseId(n),
    caseNumber: formatCaseNumber(n),
  };

  if (backend === "kv") {
    await kv.hset(KV_CASE_NUMBERS_KEY, { [created.caseId]: created.caseNumber });
  } else {
    getMemoryState().caseNumbers[created.caseId] = created.caseNumber;
  }

  return created;
}

async function lookupCaseNumber(caseId: string): Promise<string | null> {
  if (backend === "kv") {
    return kv.hget<string>(KV_CASE_NUMBERS_KEY, caseId);
  }

  return getMemoryState().caseNumbers[caseId] ?? null;
}

async function getCaseLinks(): Promise<Record<string, CaseLink>> {
  if (backend === "kv") {
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
  if (backend === "kv") {
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

    const created = await registerCase();

    return {
      id: created.caseId,
      success: true,
      errors: [],
    };
  }

  async updateFeedbackCase(
    feedbackId: string,
    caseId: string
  ): Promise<{ caseNumber: string }> {
    const exists = seedResponse.records.some(
      (record) => record.Id === feedbackId
    );

    if (!exists) {
      throw new Error("FEEDBACK_NOT_FOUND");
    }

    const caseNumber = await lookupCaseNumber(caseId);

    if (!caseNumber) {
      throw new Error("CASE_NOT_FOUND");
    }

    const created = await trySetCaseLink(feedbackId, { caseId, caseNumber });

    if (!created) {
      throw new Error("CASE_ALREADY_EXISTS");
    }

    return { caseNumber };
  }

  async clearFeedbackCases(): Promise<void> {
    if (backend === "kv") {
      const keys = seedResponse.records.map(
        (record) => KV_CASE_LINK_PREFIX + record.Id
      );
      await kv.del(KV_CASE_COUNTER_KEY, KV_CASE_NUMBERS_KEY, ...keys);
      return;
    }

    const state = getMemoryState();
    state.caseCounter = 0;
    state.caseNumbers = {};
    state.caseLinks = {};
  }
}
