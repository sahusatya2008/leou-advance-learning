"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function StudentToolbar({ classes }: { classes: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(filter: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(filter, value);
    else params.delete(filter);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:flex-none">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name, username, email"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
          className="w-full pl-9 sm:w-64"
        />
      </div>
      <Select value={searchParams.get("status") ?? ""} onValueChange={(v) => update("status", v)}>
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All statuses</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="SUSPENDED">Suspended</SelectItem>
          <SelectItem value="BLOCKED">Blocked</SelectItem>
        </SelectContent>
      </Select>
      <Select value={searchParams.get("classId") ?? ""} onValueChange={(v) => update("classId", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Class" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All classes</SelectItem>
          {classes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}