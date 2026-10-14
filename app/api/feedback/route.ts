
import { connection } from "next/server";

import { createSalesforceClient } from "@/lib/salesforce/client-factory";
import { mapFeedback } from "@/lib/salesforce/mapper";

export async function GET() {
  // Case associations live in KV/mock state and change between requests,
  // so this handler must run per request, never as a build-time snapshot
  // (with cacheComponents, route segment config like `dynamic` is banned).
  await connection();

  try {
    const client = createSalesforceClient();
    const response = await client.queryFeedback();

    return Response.json(
      {
        success: true,
        source: "salesforce-mock",
        count: response.records.length,
        data: response.records.map(mapFeedback),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Salesforce integration error:", error);

    return Response.json(
      { error: "Unable to retrieve member feedback" },
      { status: 500 }
    );
  }
}
