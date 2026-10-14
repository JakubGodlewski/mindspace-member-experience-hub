import { resetDemoData } from "@/lib/salesforce/feedback-service";

export async function POST() {
  // Demo-mode safety guard: resetting only makes sense against the mock.
  if (process.env.SALESFORCE_MOCK_MODE !== "true") {
    return Response.json(
      {
        error: {
          code: "MOCK_MODE_DISABLED",
          message: "Resetting demo data is only available in mock mode.",
        },
      },
      { status: 403 }
    );
  }

  try {
    await resetDemoData();

    return Response.json({ success: true });
  } catch (error) {
    console.error("Unexpected error while resetting demo data:", error);

    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected error while resetting demo data.",
        },
      },
      { status: 500 }
    );
  }
}
