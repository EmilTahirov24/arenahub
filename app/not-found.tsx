export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="font-display brand-gradient-text text-7xl font-bold">404</span>
      <h1 className="font-display mt-4 text-2xl font-bold">
        Səhifə tapılmadı <span className="text-foreground-muted">· Page not found</span>
      </h1>
      <p className="mt-2 max-w-md text-sm text-foreground-muted">
        Axtardığınız səhifə mövcud deyil və ya köçürülüb.
        <br />
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <a href="/" className="brand-gradient-bg mt-6 rounded-md px-5 py-2.5 text-sm font-semibold text-white">
        Ana səhifəyə qayıt · Back to home
      </a>
    </div>
  );
}
