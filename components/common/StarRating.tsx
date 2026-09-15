/**
 * How important a match is.
 *
 * The default value (1) renders NOTHING. The reason was measured: 100% of the
 * 2,359 matches in production were at 1 star, because only an admin can set
 * the value by hand and the importer never touches it. So every card carried
 * the same five marks - zero information, occupying the card's top right
 * corner.
 *
 * Rendering nothing turns a star into a real signal: if it shows, somebody
 * deliberately pushed this match forward. The rule lives in the component so
 * it holds everywhere the component is used.
 *
 * The admin panel sets the rating through its own <select>, not through this
 * component - so the control is not hidden.
 */
export default function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  if (value <= 1) return null;

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
