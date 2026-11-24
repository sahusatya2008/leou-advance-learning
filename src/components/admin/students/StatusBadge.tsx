import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusBadge = { status: "ACTIVE" | "SUSPENDED" | "BLOCKED" };

const MAP: Record<StatusBadge["status"], { variant: "default" | "secondary" | "destructive"; dot: string }> = {
  ACTIVE: { variant: "default", dot: "bg-emerald-400" },
  SUSPENDED: { variant: "secondary", dot: "bg-amber-400" },
  BLOCKED: { variant: "destructive", dot: "bg-red-400" },
};

export default function StudentStatusBadge({ status }: StatusBadge) {
  const cfg = MAP[status];
  return (
    <Badge variant={cfg.variant} className="gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {status}
    </Badge>
  );
}