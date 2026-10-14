import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resetDemoData } = vi.hoisted(() => ({
  resetDemoData: vi.fn(),
}));

vi.mock("@/lib/salesforce/feedback-service", () => ({
  resetDemoData,
}));

import { POST } from "./route";

describe("POST /api/demo/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetDemoData.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with a success payload", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(resetDemoData).toHaveBeenCalledTimes(1);
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
