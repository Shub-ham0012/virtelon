import type { AIAnalysis } from "@virtelon/db";
import { ScoreBadge } from "@/components/ui/score-badge";
import { QueueOutreachForm } from "./queue-outreach-form";

const PRIORITY_STYLES: Record<string, string> = {
  high: "text-green-600 dark:text-green-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-(--sub)",
};

export function AISection({
  analysis,
  isMock,
  leadId,
  canQueue,
}: {
  analysis: AIAnalysis | null;
  isMock: boolean;
  leadId: string;
  canQueue: boolean;
}) {
  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-(--sub)">AI analysis &amp; outreach draft</div>
        {analysis?.score != null ? <ScoreBadge score={analysis.score} /> : null}
      </div>

      {isMock ? (
        <p className="text-xs text-(--sub)">
          No Anthropic API key is configured yet, so this uses clearly-labeled sample output — useful for testing
          the pipeline before a real key is added.
        </p>
      ) : null}

      {!analysis ? (
        <p className="text-sm text-(--sub)">Not analyzed yet.</p>
      ) : (
        <div className="space-y-3 text-sm">
          {analysis.priority ? (
            <div>
              Priority:{" "}
              <span className={`font-medium ${PRIORITY_STYLES[analysis.priority] ?? ""}`}>{analysis.priority}</span>
            </div>
          ) : null}

          {analysis.reasoning.length > 0 ? (
            <div>
              <div className="mb-1 text-xs font-medium text-(--sub)">Reasoning</div>
              <ul className="list-inside list-disc space-y-0.5">
                {analysis.reasoning.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.painPoints.length > 0 ? (
            <div>
              <div className="mb-1 text-xs font-medium text-(--sub)">Pain points</div>
              <ul className="list-inside list-disc space-y-0.5">
                {analysis.painPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.opportunities.length > 0 ? (
            <div>
              <div className="mb-1 text-xs font-medium text-(--sub)">Opportunities</div>
              <ul className="list-inside list-disc space-y-0.5">
                {analysis.opportunities.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.recommendedService ? (
            <div>
              Recommended service: <span className="font-medium">{analysis.recommendedService}</span>
            </div>
          ) : null}

          {analysis.draftMessage ? (
            <div>
              <div className="mb-1 text-xs font-medium text-(--sub)">
                Draft message ({analysis.draftTone}, {analysis.draftLanguage})
              </div>
              <div className="whitespace-pre-wrap rounded-lg border border-(--border) bg-(--bg) p-3">
                {analysis.draftMessage}
              </div>
              {canQueue ? (
                <div className="mt-2">
                  <QueueOutreachForm leadId={leadId} content={analysis.draftMessage} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
