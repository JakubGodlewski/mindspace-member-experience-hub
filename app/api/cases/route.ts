import { createCaseFromFeedback } from "@/lib/salesforce/feedback-service";

function errorResponse(
  status: number,
  code: string,
  message: string
): Response {
  return Response.json({ error: { code, message } }, { status });
}

// Maps service-layer error codes to HTTP semantics with human-readable
// messages. Unknown failures are reported as a generic 500 so internal
// details (e.g. Salesforce error payloads) are never exposed to consumers.
const SERVICE_ERRORS: Record<string, { status: number; message: string }> = {
  FEEDBACK_NOT_FOUND: {
    status: 404,
    message: "Feedback record was not found.",
  },
  FEEDBACK_NOT_NEGATIVE: {
    status: 422,
    message: "A Case can only be created for negative feedback (rating 1-2).",
  },
  CONTACT_NOT_FOUND: {
    status: 422,
    message: "The feedback has no associated Contact.",
  },
  CASE_ALREADY_EXISTS: {
    status: 409,
    message: "A Case already exists for this feedback.",
  },
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "MALFORMED_JSON",
      "Request body must be valid JSON."
    );
  }

  const feedbackId =
    typeof body === "object" && body !== null && "feedbackId" in body
      ? (body as Record<string, unknown>).feedbackId
      : undefined;

  if (typeof feedbackId !== "string" || !feedbackId.trim()) {
    return errorResponse(
      400,
      "INVALID_FEEDBACK_ID",
      "feedbackId is required and must be a non-empty string."
    );
  }

  try {
    const result = await createCaseFromFeedback(feedbackId);

    return Response.json(result, { status: 201 });
  } catch (error) {
    const rawCode = error instanceof Error ? error.message : "";
    // Service errors are codes, optionally with details after a colon.
    const code = rawCode.split(":")[0].trim();
    const mapped = SERVICE_ERRORS[code];

    if (mapped) {
      return errorResponse(mapped.status, code, mapped.message);
    }

    console.error("Unexpected error while creating a Case:", error);

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Unexpected error while creating the Case."
    );
  }
}