export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-(--bg) px-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-2.5 text-center">
          <div className="font-serif-display flex h-9 w-9 items-center justify-center rounded-md bg-(--accent) text-lg font-semibold text-(--accent-ink)">
            V
          </div>
          <div>
            <div className="font-serif-display text-lg font-medium">Virtelon</div>
            <div className="text-[12px] text-(--sub)">AI-powered lead generation &amp; outreach</div>
          </div>
        </div>
        <div className="card reveal p-6">{children}</div>
      </div>
    </div>
  );
}
