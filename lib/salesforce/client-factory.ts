
import "server-only";
import type { SalesforceClient } from "./client";
import { MockSalesforceClient } from "./mock-client";

export function createSalesforceClient(): SalesforceClient {
  if (process.env.SALESFORCE_MOCK_MODE === "true") {
    return new MockSalesforceClient();
  }

  throw new Error(
    "Real Salesforce client is not implemented"
  );
}
