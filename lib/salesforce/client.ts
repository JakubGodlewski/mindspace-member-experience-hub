
import type {
  SalesforceCaseCreateRequest,
  SalesforceCreateResponse,
  SalesforceFeedbackRecord,
  SalesforceQueryResponse,
} from "./types";

export type { SalesforceCaseCreateRequest, SalesforceCreateResponse };

export interface SalesforceClient {
  queryFeedback(): Promise<
    SalesforceQueryResponse<SalesforceFeedbackRecord>
  >;

  createCase(
    request: SalesforceCaseCreateRequest
  ): Promise<SalesforceCreateResponse>;

  updateFeedbackCase(
    feedbackId: string,
    caseId: string
  ): Promise<void>;

  clearFeedbackCases(): Promise<void>;
}
