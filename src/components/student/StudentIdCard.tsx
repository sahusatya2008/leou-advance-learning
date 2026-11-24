import { GraduationCap, School } from "lucide-react";
import { STREAMS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

export type IdCardData = {
  fullName: string;
  username: string;
  classRoom: string;
  stream: string | null;
  schoolName: string;
  photoUrl: string;
  status: string;
  joined: Date | string;
};

/**
 * A printable-looking identity card. Purely presentational — every value comes
 * from the student's own profile row.
 */
export function StudentIdCard({ data }: { data: IdCardData }) {
  const streamLabel = data.stream ? (STREAMS[data.stream as keyof typeof STREAMS] ?? data.stream) : null;
  const joined = new Date(data.joined).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const idCode = data.username.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().padEnd(8, "0").slice(0, 8);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-indigo-500/15 via-card to-cyan-500/10 p-5 shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-500/20 blur-2xl"
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Student ID</span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5 text-primary" /> Leou
        </span>
      </div>

      <div className="relative mt-4 flex gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.photoUrl} alt={data.fullName} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-bold tracking-tight">{data.fullName}</h3>
            <Badge variant={data.status === "ACTIVE" ? "success" : data.status === "SUSPENDED" ? "warning" : "destructive"}>
              {data.status}
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">@{data.username}</p>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Class</p>
              <p className="truncate font-medium">{data.classRoom}</p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Stream</p>
              <p className="truncate font-medium">{streamLabel ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 truncate">
          <School className="h-3.5 w-3.5" /> {data.schoolName}
        </span>
        <span className="shrink-0 font-mono tracking-widest">{idCode}</span>
      </div>
      <p className="relative mt-1 text-[0.65rem] text-muted-foreground">Member since {joined}</p>
    </div>
  );
}
