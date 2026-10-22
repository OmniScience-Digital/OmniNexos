// src/app/jobcards/components/BackendNotReady.tsx  
import { Card, CardContent } from "@/components/ui/card";

/** Shown instead of crashing when amplify_outputs.json does not yet include the job card models. */
export default function BackendNotReady() {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">Job cards are not available yet</p>
        <p>
          The job card tables have not been deployed to this backend. Deploy the backend, run{" "}
          <code>npx ampx generate outputs</code> to refresh <code>amplify_outputs.json</code>, then restart the dev server.
        </p>
      </CardContent>
    </Card>
  );
}