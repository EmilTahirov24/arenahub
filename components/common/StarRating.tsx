export default function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value}/${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-3 w-3 ${i < value ? "fill-brand-via" : "fill-border-subtle"}`}
        >
          <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" />
        </svg>
      ))}
    </div>
  );
}
