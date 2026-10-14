import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resetDemoData } = vi.hoisted(() => ({
  resetDemoData: vi.fn(),
}));

vi.mock("@/lib/salesforce/feedback-service", () => ({
  resetDemoData,
}));

import { POST } from "./route";

const ORIGINAL_MOCK_MODE = process.env.SALESFORCE_MOCK_MODE;

describe("POST /api/demo/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.SALESFORCE_MOCK_MODE = "true";
    resetDemoData.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (ORIGINAL_MOCK_MODE === undefined) {
      delete process.env.SALESFORCE_MOCK_MODE;
    } else {
      process.env.SALESFORCE_MOCK_MODE = ORIGINAL_MOCK_MODE;
    }
    vi.restoreAllMocks();
  });

  it("returns 200 with a success payload in mock mode", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(resetDemoData).toHaveBeenCalledTimes(1);
  });

  it("returns 403 and does not call the service when mock mode is disabled", async () => {
    process.env.SALESFORCE_MOCK_MODE = "false";

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "MOCK_MODE_DISABLED",
        message: "Resetting demo data is only available in mock mode.",
      },
    });
    expect(resetDemoData).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic message on failure", async () => {
    resetDemoData.mockRejectedValue(new Error("KV connection refused"));

    const response = await POST();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected error while resetting demo data.",
      },
    });
    // Internal details must not leak to API consumers.
    expect(JSON.stringify(body)).not.toContain("KV connection refused");
  });
});
