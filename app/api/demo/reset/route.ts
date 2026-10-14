import { resetDemoData } from "@/lib/salesforce/feedback-service";

export async function POST() {
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
