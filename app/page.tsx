
"use client";

import { useEffect, useMemo, useState } from "react";
import type { MemberFeedback, FeedbackApiResponse } from "@/lib/types";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { FeedbackFilters } from "@/components/dashboard/FeedbackFilters";
import { FeedbackTable } from "@/components/dashboard/FeedbackTable";

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

      <FeedbackFilters
        locations={locations}
        categories={categories}
        location={location}
        category={category}
        rating={rating}
        onLocationChange={setLocation}
        onCategoryChange={setCategory}
        onRatingChange={setRating}
      />

      {message && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-gray-200 p-4 text-sm"
        >
          {message}
        </div>
      )}

      <FeedbackTable
        feedback={filteredFeedback}
        totalCount={feedback.length}
        createdCases={createdCases}
        creatingCaseId={creatingCaseId}
        onCreateCase={(feedbackId) => void handleCreateCase(feedbackId)}
      />

      <p className="mt-5 text-xs text-gray-500">
        Demo mode: Salesforce Case creation is simulated.
        Created Case statuses are stored only in the current browser session.
      </p>
    </main>
  );
}
