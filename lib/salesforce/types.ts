
export interface SalesforceAttributes {
  type: string;
  url: string;
}

export interface SalesforceQueryResponse<T> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

export interface SalesforceAccountRecord {
  attributes: SalesforceAttributes;
  Name: string;
}

export interface SalesforceContactRecord {
  attributes: SalesforceAttributes;
  Name: string;
  AccountId: string | null;
  Account: SalesforceAccountRecord | null;
}

export interface SalesforceCaseRecord {
  attributes: SalesforceAttributes;
  CaseNumber: string;
}

export interface SalesforceFeedbackRecord {
  attributes: SalesforceAttributes;
  Id: string;
  Name: string;
  Contact__c: string | null;
  Contact__r: SalesforceContactRecord | null;
  Location__c: string;
  Rating__c: number;
  Category__c: string;
  Comment__c: string;
  Submitted_At__c: string;
  Case__c: string | null;
  Case__r: SalesforceCaseRecord | null;
}

export interface SalesforceCaseCreateRequest {
  Subject: string;
  Description: string;
  Origin: string;
  Status: string;
  ContactId: string;
}

export interface SalesforceError {
  message: string;
  errorCode: string;
  fields: string[];
}

export interface SalesforceCreateResponse {
  id: string;
  success: boolean;
  errors: SalesforceError[];
}
