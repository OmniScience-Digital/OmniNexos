import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import {
  checklistQuestions,
  type ChecklistQuestion,
} from "./questions";

interface CommissioningFormProps {
  questions: ChecklistQuestion[];
  onQuestionsChange: (questions: ChecklistQuestion[]) => void;
}

interface PromptModalState {
  open: boolean;
  message: string;
  type: "true" | "false" | null;
}

const QCP_BADGE_COLORS: Record<string, string> = {
  "QCP - NA":
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  "Install Step":
    "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const getQcpColor = (qcp: string) => {
  if (QCP_BADGE_COLORS[qcp]) return QCP_BADGE_COLORS[qcp];
  // QCP - N numbered ones
  return "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
};

export default function JobCardForm({
  questions,
  onQuestionsChange,
}: CommissioningFormProps) {
  const [modal, setModal] = useState<PromptModalState>({
    open: false,
    message: "",
    type: null,
  });

  const handleAnswer = (index: number, value: boolean) => {
    const q = questions[index];
    const prompt = value ? q.promptOnTrue : q.promptOnFalse;

    // Update state
    const updated = [...questions];
    updated[index] = { ...updated[index], value };
    onQuestionsChange(updated);

    // Show modal if there's a prompt
    if (prompt) {
      setModal({ open: true, message: prompt, type: value ? "true" : "false" });
    }
  };

  const answered = questions.filter((q) => q.value !== null).length;
  const total = questions.length;
  const allAnswered = answered === total;

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {answered} / {total} items completed
        </span>
        {allAnswered && (
          <span className="flex items-center gap-1 text-green-600 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            All items addressed
          </span>
        )}
      </div>

      <div className="space-y-2">
        {questions.map((q, index) => (
          <div
            key={q.id}
            className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
              q.value === true
                ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10"
                : q.value === false
                ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10"
                : "border-border"
            }`}
          >
            <div className="flex items-start gap-2 flex-1 min-w-0 mr-3">
              <Badge
                variant="secondary"
                className={`shrink-0 text-xs font-normal mt-0.5 ${getQcpColor(q.qcp)}`}
              >
                {q.qcp}
              </Badge>
              <span className="text-sm leading-snug">{q.question}</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                variant={q.value === true ? "default" : "outline"}
                size="sm"
                onClick={() => handleAnswer(index, true)}
                className="cursor-pointer"
              >
                True
              </Button>
              <Button
                type="button"
                variant={q.value === false ? "destructive" : "outline"}
                size="sm"
                onClick={() => handleAnswer(index, false)}
                className="cursor-pointer"
              >
                False
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Prompt Modal */}
      <Dialog open={modal.open} onOpenChange={(o) => setModal((m) => ({ ...m, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modal.type === "false" ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Action Required
                </>
              ) : (
                <>
                  <Info className="h-5 w-5 text-blue-500" />
                  Next Step
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">{modal.message}</p>
          <div className="flex justify-end">
            <Button
              onClick={() => setModal((m) => ({ ...m, open: false }))}
              variant={modal.type === "false" ? "destructive" : "default"}
              className="cursor-pointer"
            >
              Acknowledged
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { checklistQuestions };