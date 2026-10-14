"use client";

import type { MemberFeedback } from "@/lib/types";

interface FeedbackTableProps {
  feedback: MemberFeedback[];
  totalCount: number;
  createdCases: Record<string, string>;
  creatingCaseId: string | null;
  onCreateCase: (feedbackId: string) => void;
}

export function FeedbackTable({
  feedback,
  totalCount,
  createdCases,
  creatingCaseId,
  onCreateCase,
}: FeedbackTableProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-5">
        <h2 className="text-xl font-semibold text-gray-900">
          Member feedback
        </h2>
        <p className="text-sm text-gray-500">
          Showing {feedback.length} of {totalCount} surveys
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm text-gray-800">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-4">Member</th>
              <th className="p-4">Location</th>
              <th className="p-4">Category</th>
              <th className="p-4">Rating</th>
              <th className="p-4">Comment</th>
              <th className="p-4">Case</th>
            </tr>
          </thead>

          <tbody>
            {feedback.map((item) => {
              const caseId = createdCases[item.id] ?? item.caseId;

              return (
                <tr key={item.id} className="border-t border-gray-100">
                  <td className="p-4">
                    <div className="font-medium">{item.contactName}</div>
                    <div className="text-xs text-gray-500">
                      {item.accountName}
                    </div>
                  </td>

                  <td className="p-4">{item.location}</td>
                  <td className="p-4">{item.category}</td>

                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 font-medium ${
                        item.score <= 2
                          ? "bg-red-100 text-red-700"
                          : item.score === 3
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      {item.score} / 5
                    </span>
                  </td>

                  <td className="max-w-xs p-4">{item.comment}</td>

                  <td className="p-4">
                    {caseId ? (
                      <div>
                        <span className="font-medium text-green-700">
                          Case Created
                        </span>
                        <div className="text-xs text-gray-500">{caseId}</div>
                      </div>
                    ) : item.score <= 2 ? (
                      <button
                        onClick={() => onCreateCase(item.id)}
                        disabled={creatingCaseId !== null}
                        className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {creatingCaseId === item.id
                          ? "Creating..."
                          : "Create Case"}
                      </button>
                    ) : (
                      <span className="text-gray-400">Not required</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {feedback.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-gray-500">
                  No feedback matches your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
