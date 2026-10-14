
import salesforceResponse from "@/lib/mocks/salesforce-feedback-query-response.json";

export async function GET() {
  return Response.json(salesforceResponse);
}
