import type { PlayerSocials } from "@/lib/socials";

const ICONS: Record<keyof PlayerSocials, { label: string; path: string }> = {
  instagram: {
    label: "Instagram",
    path: "M12 2c2.7 0 3 0 4.1.06 1.1.05 1.8.22 2.4.46.7.27 1.2.6 1.7 1.1.5.5.9 1 1.1 1.7.24.6.4 1.3.46 2.4C21.9 8.5 22 8.8 22 11.5v1c0 2.7 0 3-.06 4.1-.05 1.1-.22 1.8-.46 2.4a4.9 4.9 0 0 1-1.1 1.7c-.5.5-1 .9-1.7 1.1-.6.24-1.3.4-2.4.46-1.1.06-1.4.06-4.1.06h-1c-2.7 0-3 0-4.1-.06-1.1-.05-1.8-.22-2.4-.46a4.9 4.9 0 0 1-1.7-1.1 4.9 4.9 0 0 1-1.1-1.7c-.24-.6-.4-1.3-.46-2.4C2 15.5 2 15.2 2 12.5v-1c0-2.7 0-3 .06-4.1.05-1.1.22-1.8.46-2.4a4.9 4.9 0 0 1 1.1-1.7 4.9 4.9 0 0 1 1.7-1.1c.6-.24 1.3-.4 2.4-.46C8.8 2 9.1 2 11.8 2H12Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm5.2-8.4a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z",
  },
  twitter: {
    label: "X / Twitter",
    path: "M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.8L5.2 22H2l7.7-8.8L1.6 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.7L7.4 3.9H5.6L17.7 20Z",
  },
  faceit: {
    label: "Faceit",
    path: "M4 4h16v4H8v4h10v4H8v4h12v4H4V4Z",
  },
  twitch: {
    label: "Twitch",
    path: "M4 2 2 6.5V19h6v3l3-3h4.5L21 13.5V2H4Zm15 10.5-3 3h-4l-2.5 2.5V15.5H6V4h13v8.5Zm-3-6h-2v5h2v-5Zm-5 0H9v5h2v-5Z",
  },
};

export default function SocialLinks({ socials }: { socials: PlayerSocials }) {
  const entries = (Object.keys(ICONS) as (keyof PlayerSocials)[]).filter((k) => socials[k]);
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {entries.map((key) => (
        <a
          key={key}
          href={socials[key]}
          target="_blank"
          rel="noopener noreferrer"
          title={ICONS[key].label}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground-muted transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d={ICONS[key].path} />
          </svg>
        </a>
      ))}
    </div>
  );
}
