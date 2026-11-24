import { Card } from "@/components/ui/card";
import { getPracticalCatalog } from "@/services/practicalService";
import PracticalBuilder from "@/components/admin/practical/PracticalBuilder";
import { FlaskConical } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Practical assignment builder.
 *
 * Walks class -> batch -> subject -> chapter and manages the practical question
 * set for that chapter. Reads the cascade server-side so the first paint already
 * knows which chapters exist, instead of fetching an empty shell.
 */
export default async function PracticalPage() {
  // Computer Science only for now; the service takes null to widen later.
  const catalog = await getPracticalCatalog("CS");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
          <FlaskConical className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Practical Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Build the guided practical set students work through, one chapter at a time. Questions
            appear here once they are tagged <strong>Practical question</strong> on the question bank.
          </p>
        </div>
      </div>

      <Card className="p-4 md:p-6">
        <PracticalBuilder catalog={catalog} />
      </Card>
    </div>
  );
}