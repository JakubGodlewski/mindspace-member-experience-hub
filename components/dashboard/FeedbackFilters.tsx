"use client";

const RATING_OPTIONS = ["All", "Negative", "Neutral", "Positive"];

interface FeedbackFiltersProps {
  locations: string[];
  categories: string[];
  location: string;
  category: string;
  rating: string;
  onLocationChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onRatingChange: (value: string) => void;
}

export function FeedbackFilters({
  locations,
  categories,
  location,
  category,
  rating,
  onLocationChange,
  onCategoryChange,
  onRatingChange,
}: FeedbackFiltersProps) {
  return (
    <section className="mb-6 flex flex-wrap gap-3">
      <Filter
        label="Location"
        value={location}
        options={["All", ...locations]}
        onChange={onLocationChange}
      />

      <Filter
        label="Category"
        value={category}
        options={["All", ...categories]}
        onChange={onCategoryChange}
      />

      <Filter
        label="Rating"
        value={rating}
        options={RATING_OPTIONS}
        onChange={onRatingChange}
      />
    </section>
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
