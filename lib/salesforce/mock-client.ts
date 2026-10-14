
import mockResponse from "../mocks/salesforce-feedback-query-response.json";
import type {
  SalesforceClient,
  SalesforceCaseCreateRequest,
  SalesforceCreateResponse,
} from "./client";
import type {
  SalesforceFeedbackRecord,
  SalesforceQueryResponse,
} from "./types";

export class MockSalesforceClient implements SalesforceClient {
  async queryFeedback(): Promise<
    SalesforceQueryResponse<SalesforceFeedbackRecord>
  > {
    return mockResponse as SalesforceQueryResponse<
      SalesforceFeedbackRecord
    >;
  }

  async createCase(
    request: SalesforceCaseCreateRequest
  ): Promise<SalesforceCreateResponse> {
    if (!request.Subject || !request.ContactId) {
      return {
        id: "",
        success: false,
        errors: ["REQUIRED_FIELD_MISSING"],
      };
    }

    return {
      id: "500000000000001AAA",
      success: true,
      errors: [],
    };
  }
}
