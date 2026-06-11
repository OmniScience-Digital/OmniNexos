import { useState } from "react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import ResponseModal from "@/components/widgets/response";
import { checklistQuestions } from "./components/questions";
import CommissioningForm from "./components/checklistForm";
import type { ChecklistQuestion } from "./components/questions";

export default function JobCardChecklistPage() {
  const [questions, setQuestions] = useState<ChecklistQuestion[]>(
    checklistQuestions.map((q) => ({ ...q }))
  );
  const [loadingbtn, setLoadingbtn] = useState(false);
  const [show, setShow] = useState(false);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");

  const canSubmit = !questions.some((q) => q.value === null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      setMessage("Please answer all checklist items before submitting.");
      setSuccessful(false);
      setShow(true);
      return;
    }

    try {
      setLoadingbtn(true);

      // Demo: just simulate a brief delay — no DB yet
      await new Promise((resolve) => setTimeout(resolve, 800));

      setMessage("Commissioning checklist submitted successfully.");
      setSuccessful(true);
      setShow(true);

      // Reset form
      setQuestions(checklistQuestions.map((q) => ({ ...q, value: null })));
    } catch (err) {
      setMessage(
        "Failed to submit: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
      setSuccessful(false);
      setShow(true);
    } finally {
      setLoadingbtn(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="flex-1 p-6 mt-20 pb-20">
        {show && (
          <ResponseModal
            successful={successful}
            message={message}
            setShow={setShow}
          />
        )}

        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Commissioning Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <form className="space-y-6 mt-2" onSubmit={handleSubmit}>
                  <CommissioningForm
                    questions={questions}
                    onQuestionsChange={setQuestions}
                  />

                  <div
                    className={`p-3 rounded-md border ${
                      canSubmit
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}
                  >
                    <p className="text-sm font-medium">
                      {canSubmit
                        ? "✅ All set! Form is ready for submission."
                        : "⚠️ Please answer all checklist items before submitting"}
                    </p>
                  </div>

                  <div className="flex justify-end mt-2">
                    <Button
                      type="submit"
                      className="cursor-pointer"
                      disabled={!canSubmit || loadingbtn}
                    >
                      {loadingbtn ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Checklist"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}