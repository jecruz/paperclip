import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { issuesApi } from "@/api/issues";
import { PHASE_LABELS } from "./PhaseOutputCard";
import type { PhaseOutput, PhaseOutputStatus, PhaseOutputContent } from "@paperclipai/shared";

const CONTENT_KIND_OPTIONS = [
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Plain Text" },
  { value: "json", label: "JSON" },
] as const;

export function PhaseOutputModal({
  issueId,
  open,
  onOpenChange,
  onSuccess,
  initialData,
}: {
  issueId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialData?: PhaseOutput;
}) {
  const isEditMode = !!initialData;
  const wasOpenRef = useRef(false);

  const [phase, setPhase] = useState("product_plan");
  const [contentKind, setContentKind] = useState<"markdown" | "text" | "json">("markdown");
  const [contentText, setContentText] = useState("");
  const [jsonText, setJsonText] = useState("{\n  \n}");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (!wasOpenRef.current && open && initialData) {
      setPhase(initialData.phase);
      setContentKind(initialData.content.kind);
      if (initialData.content.kind === "json") {
        setJsonText(JSON.stringify(initialData.content.data, null, 2));
        setContentText("");
      } else {
        setContentText(initialData.content.text);
        setJsonText("{\n  \n}");
      }
    } else if (wasOpenRef.current && !open) {
      setContentText("");
      setJsonText("{\n  \n}");
      setPhase("product_plan");
      setContentKind("markdown");
      setJsonError(null);
    }
    wasOpenRef.current = open;
  }, [open, initialData]);

  const mutation = useMutation({
    mutationFn: async () => {
      const content: PhaseOutputContent =
        contentKind === "json"
          ? { kind: "json", data: JSON.parse(jsonText) as Record<string, unknown> }
          : { kind: contentKind, text: contentText };

      return issuesApi.updatePhaseOutput(issueId, phase, { content });
    },
    onSuccess: () => {
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contentKind !== "json" && !contentText.trim()) return;
    if (contentKind === "json") {
      try {
        JSON.parse(jsonText);
        setJsonError(null);
      } catch {
        setJsonError("Invalid JSON syntax");
        return;
      }
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Phase Output" : "Add Phase Output"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phase">Phase</Label>
              <Select value={phase} onValueChange={setPhase} disabled={isEditMode}>
                <SelectTrigger id="phase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PHASE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content-kind">Content Type</Label>
              <Select
                value={contentKind}
                onValueChange={(v) => {
                  setContentKind(v as "markdown" | "text" | "json");
                  setJsonError(null);
                }}
              >
                <SelectTrigger id="content-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_KIND_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {contentKind === "json" ? (
              <div className="space-y-2">
                <Label htmlFor="json-content">JSON Content</Label>
                <Textarea
                  id="json-content"
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    setJsonError(null);
                  }}
                  className="font-mono text-sm min-h-[200px]"
                  placeholder={"{\n  \n}"}
                />
                {jsonError && (
                  <p className="text-xs text-red-500">{jsonError}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="text-content">
                  {contentKind === "markdown" ? "Markdown" : "Text"} Content
                </Label>
                <Textarea
                  id="text-content"
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  className="min-h-[200px]"
                  placeholder={
                    contentKind === "markdown"
                      ? "# Header\n\nYour content here..."
                      : "Enter text content..."
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                (contentKind !== "json" && !contentText.trim())
              }
            >
              {mutation.isPending ? "Saving..." : isEditMode ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
