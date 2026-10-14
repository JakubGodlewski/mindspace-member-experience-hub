import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createCaseFromFeedback } = vi.hoisted(() => ({
  createCaseFromFeedback: vi.fn(),
}));

vi.mock("@/lib/salesforce/feedback-service", () => ({
  createCaseFromFeedback,
}));

import { POST } from "./route";

const FEEDBACK_ID = "a01000000000028AAA";

function postJson(body: unknown): Request {
  return new Request("http://localhost/api/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});

  createCaseFromFeedback.mockResolvedValue({
    feedbackId: FEEDBACK_ID,
    caseId: "500000000000001AAA",
    caseNumber: "00000001",
    success: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/cases", () => {
  it("returns 201 with the Case creation response for a valid request", async () => {
    const response = await POST(postJson({ feedbackId: FEEDBACK_ID }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      feedbackId: FEEDBACK_ID,
      caseId: "500000000000001AAA",
      caseNumber: "00000001",
      success: true,
    });
    expect(createCaseFromFeedback).toHaveBeenCalledWith(FEEDBACK_ID);
  });

  it("returns 400 MALFORMED_JSON for an invalid JSON body", async () => {
    const response = await POST(postJson("{ not json"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "MALFORMED_JSON",
        message: "Request body must be valid JSON.",
      },
    });
    expect(createCaseFromFeedback).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", {}],
    ["empty", { feedbackId: "" }],
    ["blank", { feedbackId: "   " }],
    ["non-string", { feedbackId: 42 }],
  ])(
    "returns 400 INVALID_FEEDBACK_ID when feedbackId is %s",
    async (_case, body) => {
      const response = await POST(postJson(body));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "INVALID_FEEDBACK_ID",
          message: "feedbackId is required and must be a non-empty string.",
        },
      });
      expect(createCaseFromFeedback).not.toHaveBeenCalled();
    }
  );

  it("trims whitespace around feedbackId before calling the service", async () => {
    const response = await POST(postJson({ feedbackId: `  ${FEEDBACK_ID}  ` }));

    expect(response.status).toBe(201);
    expect(createCaseFromFeedback).toHaveBeenCalledWith(FEEDBACK_ID);
  });

  it.each([
    ["FEEDBACK_NOT_FOUND", 404],
    ["FEEDBACK_NOT_NEGATIVE", 422],
    ["CONTACT_NOT_FOUND", 422],
    ["CASE_ALREADY_EXISTS", 409],
  ])(
    "maps service error %s to HTTP %i",
    async (serviceCode, expectedStatus) => {
      createCaseFromFeedback.mockRejectedValue(new Error(serviceCode));

      const response = await POST(postJson({ feedbackId: FEEDBACK_ID }));

      expect(response.status).toBe(expectedStatus);
      const body = await response.json();
      expect(body.error.code).toBe(serviceCode);
      expect(typeof body.error.message).toBe("string");
    }
  );

  it("returns 500 with a generic message for unexpected service failures", async () => {
    createCaseFromFeedback.mockRejectedValue(
      new Error("SALESFORCE_CREATE_FAILED: REQUIRED_FIELD_MISSING [Subject]")
    );

    const response = await POST(postJson({ feedbackId: FEEDBACK_ID }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected error while creating the Case.",
      },
    });
    // Internal details must not leak to API consumers.
    expect(JSON.stringify(body)).not.toContain("REQUIRED_FIELD_MISSING");
  });

  it("returns 500 for non-Error throwables", async () => {
    createCaseFromFeedback.mockRejectedValue("unexpected string failure");

    const response = await POST(postJson({ feedbackId: FEEDBACK_ID }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
