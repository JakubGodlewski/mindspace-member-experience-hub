
"use client";

import { useEffect, useMemo, useState } from "react";
import type { MemberFeedback, FeedbackApiResponse } from "@/lib/types";

export default function Home() {
  const [feedback, setFeedback] = useState<MemberFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [location, setLocation] = useState("All");
  const [category, setCategory] = useState("All");
  const [rating, setRating] = useState("All");

  const [creatingCaseId, setCreatingCaseId] = useState<string | null>(null);
  const [createdCases, setCreatedCases] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadFeedback() {
      try {
        const response = await fetch("/api/feedback");

        if (!response.ok) {
          throw new Error("Failed to load feedback");
        }

        const result: FeedbackApiResponse = await response.json();

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error("Invalid API response");
        }

        setFeedback(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unexpected error"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadFeedback();
  }, []);

  const locations = useMemo(
    () => [...new Set(feedback.map((f) => f.location))].sort(),
    [feedback]
  );

  const categories = useMemo(
    () => [...new Set(feedback.map((f) => f.category))].sort(),
    [feedback]
  );

  const filteredFeedback = useMemo(() => {
    return feedback.filter((item) => {
      if (location !== "All" && item.location !== location) {
        return false;
      }

      if (category !== "All" && item.category !== category) {
        return false;
      }

      if (rating === "Negative" && item.score > 2) {
        return false;
      }

      if (rating === "Positive" && item.score < 4) {
        return false;
      }

      if (rating === "Neutral" && item.score !== 3) {
        return false;
      }

      return true;
    });
  }, [feedback, location, category, rating]);

  const averageRating = feedback.length
    ? (
        feedback.reduce((sum, item) => sum + item.score, 0) /
        feedback.length
      ).toFixed(1)
    : "0.0";

  const negativeCount = feedback.filter(
    (item) => item.score <= 2
  ).length;

  async function handleCreateCase(feedbackId: string) {
    setCreatingCaseId(feedbackId);
    setMessage(null);

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ feedbackId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.caseId) {
        throw new Error(result.error ?? "Failed to create Case");
      }

      setCreatedCases((previous) => ({
        ...previous,
        [feedbackId]: result.caseId,
      }));

      setMessage(`Case ${result.caseId} created successfully (mock).`);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Unexpected error"
      );
    } finally {
      setCreatingCaseId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl p-8">
        <p>Loading member feedback...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl p-8">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Member Experience Hub
          </h1>
          <p className="mt-2 text-gray-500">
            Monitor member satisfaction across locations
          </p>
        </div>

        <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-800">
          Salesforce Mock
        </span>
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <KpiCard title="Total surveys" value={String(feedback.length)} />
        <KpiCard title="Average rating" value={`${averageRating} / 5`} />
        <KpiCard title="Negative feedback" value={String(negativeCount)} />
      </section>

      <section className="mb-6 flex flex-wrap gap-3">
        <Filter
          label="Location"
          value={location}
          options={["All", ...locations]}
          onChange={setLocation}
        />

        <Filter
          label="Category"
          value={category}
          options={["All", ...categories]}
          onChange={setCategory}
        />

        <Filter
          label="Rating"
          value={rating}
          options={["All", "Negative", "Neutral", "Positive"]}
          onChange={setRating}
        />
      </section>

      {message && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-gray-200 p-4 text-sm"
        >
          {message}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-5">
          <h2 className="text-xl font-semibold text-gray-900">
            Member feedback
          </h2>
          <p className="text-sm text-gray-500">
            Showing {filteredFeedback.length} of {feedback.length} surveys
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
              {filteredFeedback.map((item) => {
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
                          <div className="text-xs text-gray-500">
                            {caseId}
                          </div>
                        </div>
                      ) : item.score <= 2 ? (
                        <button
                          onClick={() => void handleCreateCase(item.id)}
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

              {filteredFeedback.length === 0 && (
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

      <p className="mt-5 text-xs text-gray-500">
        Demo mode: Salesforce Case creation is simulated.
        Created Case statuses are stored only in the current browser session.
      </p>
    </main>
  );
}

function KpiCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
