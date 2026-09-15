export type Country = { code: string; name: string };

// ISO 3166-1 alpha-2 codes with common English names, used to populate country
// <select> inputs and to keep stored codes valid so flag-icons always has a match.
export const COUNTRIES: Country[] = [
  { code: "AZ", name: "Azerbaijan" },
  { code: "TR", name: "Turkey" },
  { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
  { code: "GE", name: "Georgia" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "Mexico" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "DK", name: "Denmark" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "IS", name: "Iceland" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czechia" },
  { code: "SK", name: "Slovakia" },
  { code: "HU", name: "Hungary" },
  { code: "RO", name: "Romania" },
  { code: "BG", name: "Bulgaria" },
  { code: "GR", name: "Greece" },
  { code: "HR", name: "Croatia" },
  { code: "RS", name: "Serbia" },
  { code: "SI", name: "Slovenia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "MK", name: "North Macedonia" },
  { code: "AL", name: "Albania" },
  { code: "EE", name: "Estonia" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "BY", name: "Belarus" },
  { code: "MD", name: "Moldova" },
  { code: "AM", name: "Armenia" },
  { code: "CY", name: "Cyprus" },
  { code: "MT", name: "Malta" },
  { code: "LU", name: "Luxembourg" },
  { code: "MC", name: "Monaco" },
  { code: "AD", name: "Andorra" },
  { code: "KR", name: "South Korea" },
  { code: "KP", name: "North Korea" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "MN", name: "Mongolia" },
  { code: "TW", name: "Taiwan" },
  { code: "HK", name: "Hong Kong" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "LK", name: "Sri Lanka" },
  { code: "NP", name: "Nepal" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "PH", name: "Philippines" },
  { code: "MM", name: "Myanmar" },
  { code: "KH", name: "Cambodia" },
  { code: "LA", name: "Laos" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TJ", name: "Tajikistan" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "AF", name: "Afghanistan" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "BH", name: "Bahrain" },
  { code: "OM", name: "Oman" },
  { code: "YE", name: "Yemen" },
  { code: "JO", name: "Jordan" },
  { code: "LB", name: "Lebanon" },
  { code: "SY", name: "Syria" },
  { code: "IL", name: "Israel" },
  { code: "PS", name: "Palestine" },
  { code: "EG", name: "Egypt" },
  { code: "LY", name: "Libya" },
  { code: "TN", name: "Tunisia" },
  { code: "DZ", name: "Algeria" },
  { code: "MA", name: "Morocco" },
  { code: "SD", name: "Sudan" },
  { code: "ET", name: "Ethiopia" },
  { code: "KE", name: "Kenya" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "ZA", name: "South Africa" },
  { code: "TZ", name: "Tanzania" },
  { code: "UG", name: "Uganda" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "AO", name: "Angola" },
  { code: "CM", name: "Cameroon" },
  { code: "CI", name: "Ivory Coast" },
  { code: "SN", name: "Senegal" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "FJ", name: "Fiji" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
  { code: "VE", name: "Venezuela" },
  { code: "EC", name: "Ecuador" },
  { code: "BO", name: "Bolivia" },
  { code: "PY", name: "Paraguay" },
  { code: "UY", name: "Uruguay" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panama" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "SV", name: "El Salvador" },
  { code: "NI", name: "Nicaragua" },
  { code: "CU", name: "Cuba" },
  { code: "DO", name: "Dominican Republic" },
  { code: "JM", name: "Jamaica" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "CW", name: "Curaçao" },
  { code: "PR", name: "Puerto Rico" },
];

export function countryName(code?: string | null): string | null {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ?? code;
}

/**
 * Other names the sources give the same country.
 *
 * These are deliberately NOT added to COUNTRIES, because that list feeds the
 * country picker in the forms - two names for one country would show up there
 * as a duplicate option. An alias is recognised on lookup only.
 *
 * The list is built from measurement, not guesswork: the importer records the
 * names it does not recognise, ordered by how often they recur. "Czech
 * Republic" blocked 8 teams in a real run - Liquipedia uses that name, while
 * our list carries "Czechia".
 */
const ALIASES: Record<string, string> = {
  "czech republic": "CZ",
};

const CODE_BY_NAME = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c.code]));
const VALID_CODE = new Set(COUNTRIES.map((c) => c.code));

/**
 * Turns the country name Liquipedia writes into an ISO code: "France" to "FR".
 *
 * An unknown name is NOT guessed at; null comes back instead. These are real
 * organisations, and the wrong country is worse than no country. For the same
 * reason the result is checked against COUNTRIES, so a stored code always has
 * a flag icon behind it.
 *
 * This used to be buried inside scripts/import-teams.ts; when a second import
 * script needed the same conversion it was lifted here rather than copied.
 */
export function countryCode(location: string | null | undefined): string | null {
  if (!location) return null;
  const key = location.trim().toLowerCase();
  const code = CODE_BY_NAME.get(key) ?? ALIASES[key];
  return code && VALID_CODE.has(code) ? code : null;
}
