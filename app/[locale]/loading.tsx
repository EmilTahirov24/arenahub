function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-raised ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-[1400px] items-start gap-4 px-4 py-6">
      <aside className="sticky top-20 hidden w-[160px] shrink-0 xl:block">
        <Block className="h-[600px]" />
      </aside>

      <main className="min-w-0 flex-1">
        <Block className="mb-4 h-8 w-48" />
        <Block className="mb-6 h-10 w-full max-w-md" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Block key={i} className="h-20" />
          ))}
        </div>
      </main>

      <aside className="hidden w-[300px] shrink-0 space-y-4 lg:block">
        <Block className="h-[250px]" />
        <Block className="h-40" />
        <Block className="h-40" />
      </aside>
    </div>
  );
}
