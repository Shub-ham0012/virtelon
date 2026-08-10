export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-lg font-semibold tracking-tight">Virtelon Platform</div>
          <div className="text-sm text-(--sub)">AI-powered lead generation & outreach</div>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
