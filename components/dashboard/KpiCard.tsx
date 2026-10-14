interface KpiCardProps {
  title: string;
  value: string;
}

export function KpiCard({ title, value }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
