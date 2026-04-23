import { memo } from "react";
import { CheckCircle2, XCircle, Clock, FileJson, FileText, File } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo } from "../lib/timeAgo";
import type { PhaseOutput, PhaseOutputContent, PhaseOutputStatus } from "@paperclipai/shared";

const PHASE_LABELS: Record<string, string> = {
  product_plan: "Product Plan",
  tech_plan: "Tech Plan",
  code_review: "Code Review",
  ship_report: "Ship Report",
  qa_report: "QA Report",
};

function statusIcon(status: PhaseOutputStatus) {
  if (status === "approved") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
  if (status === "rejected") return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
  if (status === "in_review") return <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

function statusColor(status: PhaseOutputStatus) {
  if (status === "approved") return "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800";
  if (status === "rejected") return "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800";
  if (status === "in_review") return "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800";
  return "text-muted-foreground border-border";
}

function ContentIcon({ content }: { content: PhaseOutputContent }) {
  if (content.kind === "json") return <FileJson className="h-4 w-4 text-muted-foreground" />;
  if (content.kind === "markdown") return <FileText className="h-4 w-4 text-muted-foreground" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function ContentPreview({ content }: { content: PhaseOutputContent }) {
  if (content.kind === "json") {
    const data = content.data as Record<string, unknown>;
    const keys = Object.keys(data).slice(0, 4);
    return (
      <div className="space-y-1">
        {keys.map((key) => (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="font-mono text-muted-foreground">{key}:</span>
            <span className="font-mono text-foreground break-all">
              {Array.isArray(data[key]) ? `[${(data[key] as unknown[]).length} items]` :
               typeof data[key] === "object" ? `{${Object.keys(data[key] as object).length} keys}` :
               String(data[key]).slice(0, 60)}
            </span>
          </div>
        ))}
        {Object.keys(data).length > 4 && (
          <span className="text-xs text-muted-foreground">+{Object.keys(data).length - 4} more fields</span>
        )}
      </div>
    );
  }
  const text = content.text;
  return (
    <p className="text-xs text-muted-foreground line-clamp-3">
      {text.slice(0, 200)}{text.length > 200 ? "..." : ""}
    </p>
  );
}

export const PhaseOutputCard = memo(function PhaseOutputCard({
  phaseOutput,
  onSubmitForReview,
  onApprove,
  onReject,
  isUpdating = false,
}: {
  phaseOutput: PhaseOutput;
  onSubmitForReview?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  isUpdating?: boolean;
}) {
  const phaseLabel = PHASE_LABELS[phaseOutput.phase] ?? phaseOutput.phase;
  const canEdit = phaseOutput.status === "draft";
  const canReview = phaseOutput.status === "in_review";

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80">
              <ContentIcon content={phaseOutput.content} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {phaseLabel}
                </Badge>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold leading-6 text-foreground">
                  {phaseLabel} Output
                </h3>
                <p className="text-xs leading-5 text-muted-foreground">
                  Created {phaseOutput.createdAt ? timeAgo(phaseOutput.createdAt) : "never"}
                  {phaseOutput.updatedAt && phaseOutput.updatedAt !== phaseOutput.createdAt && (
                    <> · Updated {timeAgo(phaseOutput.updatedAt)}</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <div className={cn("inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-xs", statusColor(phaseOutput.status))}>
            {statusIcon(phaseOutput.status)}
            <span className="capitalize">{phaseOutput.status.replace(/_/g, " ")}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-border/60 pt-4">
        <ContentPreview content={phaseOutput.content} />
      </div>

      {phaseOutput.approvedAt && (
        <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
          Approved {timeAgo(phaseOutput.approvedAt)}
        </div>
      )}

      {(canEdit || canReview) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && onSubmitForReview && (
              <Button
                size="sm"
                variant="outline"
                onClick={onSubmitForReview}
                disabled={isUpdating}
              >
                Submit for Review
              </Button>
            )}
            {canReview && onApprove && (
              <Button
                size="sm"
                className="bg-green-700 hover:bg-green-600 text-white"
                onClick={onApprove}
                disabled={isUpdating}
              >
                Approve
              </Button>
            )}
            {canReview && onReject && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700 dark:text-red-400"
                onClick={onReject}
                disabled={isUpdating}
              >
                Reject
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
