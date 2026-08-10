import type { WebsiteAudit } from "@virtelon/db";
import type { SocialProfilesJson } from "@virtelon/core/presence-research";
import { ScoreBadge } from "@/components/ui/score-badge";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  x: "X (Twitter)",
};

export function PresenceSection({
  website,
  websiteAudit,
  socialProfiles,
}: {
  website: string | null;
  websiteAudit: WebsiteAudit | null;
  socialProfiles: SocialProfilesJson;
}) {
  const platforms = Object.entries(socialProfiles) as [string, SocialProfilesJson[keyof SocialProfilesJson]][];

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-(--sub)">Website audit</div>
          <ScoreBadge score={websiteAudit?.score ?? null} />
        </div>
        {!website ? (
          <p className="text-sm text-(--sub)">No website found for this business — see social profiles below instead.</p>
        ) : !websiteAudit ? (
          <p className="text-sm text-(--sub)">Not audited yet — click "Research this lead" below.</p>
        ) : !websiteAudit.reachable ? (
          <p className="text-sm text-(--danger)">Website did not respond when last checked.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {websiteAudit.strengths.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-(--sub)">Strengths</div>
                <ul className="list-inside list-disc space-y-0.5">
                  {websiteAudit.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {websiteAudit.problems.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-(--sub)">Problems</div>
                <ul className="list-inside list-disc space-y-0.5 text-(--danger)">
                  {websiteAudit.problems.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {websiteAudit.opportunities.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-(--sub)">Opportunities</div>
                <ul className="list-inside list-disc space-y-0.5">
                  {websiteAudit.opportunities.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="mb-3 text-xs uppercase tracking-wide text-(--sub)">Social profiles</div>
        {platforms.length === 0 ? (
          <p className="text-sm text-(--sub)">None found yet.</p>
        ) : (
          <div className="space-y-2">
            {platforms.map(([platform, profile]) => (
              <div key={platform} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{PLATFORM_LABELS[platform] ?? platform}</span>{" "}
                  <a href={profile?.url} target="_blank" rel="noreferrer" className="text-(--accent)">
                    {profile?.url}
                  </a>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    profile?.confidence === "high"
                      ? "bg-green-600/10 text-green-600 dark:text-green-400"
                      : "bg-amber-600/10 text-amber-600 dark:text-amber-400"
                  }`}
                  title={profile?.confidence === "high" ? "Confirmed from the business's own website" : "Best guess from search — not confirmed"}
                >
                  {profile?.confidence === "high" ? "Confirmed" : "Unconfirmed guess"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
