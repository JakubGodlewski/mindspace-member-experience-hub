import { createCaseFromFeedback } from "@/lib/salesforce/feedback-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (
      typeof body.feedbackId !== "string" ||
      !body.feedbackId.trim()
    ) {
      return Response.json(
        { error: "feedbackId is required" },
        { status: 400 }
      );
    }

    const result = await createCaseFromFeedback(
      body.feedbackId
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "UNKNOWN_ERROR";

    const status =
      message === "FEEDBACK_NOT_FOUND" ? 404 :
      message === "FEEDBACK_NOT_NEGATIVE" ? 422 :
      message === "CASE_ALREADY_EXISTS" ? 409 :
      500;

    return Response.json(
      { error: message },
      { status }
    );
  }
}