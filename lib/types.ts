
export interface MemberFeedback {
  id: string;
  contactId: string | null;
  contactName: string;
  accountName: string;
  location: string;
  score: number;
  category: string;
  comment: string;
  submittedAt: string;
  caseId: string | null;
  caseNumber: string | null;
}

export interface FeedbackApiResponse {
  success: boolean;
  source: string;
  count: number;
  data: MemberFeedback[];
}

export interface CreateCaseRequest {
  feedbackId: string;
}

export interface CreateCaseResponse {
  success: boolean;
  feedbackId: string;
  caseId: string;
  caseNumber: string;
}
