import { countryName } from "@/lib/countries";

export default function CountryFlag({
  code,
  size = 14,
  className = "",
}: {
  code?: string | null;
  size?: number;
  className?: string;
}) {
  if (!code) return null;

  return (
    <span
      className={`fi fi-${code.toLowerCase()} shrink-0 rounded-[2px] align-middle ${className}`}
      style={{ fontSize: size }}
      title={countryName(code) ?? code}
    />
  );
}
