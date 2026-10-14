
import type {
  SalesforceFeedbackRecord,
  SalesforceQueryResponse,
} from "./types";

export interface SalesforceCaseCreateRequest {
  Subject: string;
  Description: string;
  Origin: string;
  Status: string;
  ContactId: string;
}

export interface SalesforceCreateResponse {
  id: string;
  success: boolean;
  errors: string[];
}

export interface SalesforceClient {
  queryFeedback(): Promise<
    SalesforceQueryResponse<SalesforceFeedbackRecord>
  >;

  createCase(
    request: SalesforceCaseCreateRequest
  ): Promise<SalesforceCreateResponse>;
}
