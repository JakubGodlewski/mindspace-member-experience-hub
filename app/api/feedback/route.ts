
import { createSalesforceClient } from "@/lib/salesforce/client-factory";
import { mapFeedback } from "@/lib/salesforce/mapper";


export async function GET() {
  try {
    const client = createSalesforceClient();
    const response = await client.queryFeedback();

    return Response.json({
      success: true,
      source: "salesforce-mock",
      count: response.records.length,
      data: response.records.map(mapFeedback),
    });
  } catch (error) {
    console.error("Salesforce integration error:", error);

    return Response.json(
      { error: "Unable to retrieve member feedback" },
      { status: 500 }
    );
  }
}
