"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Save, GraduationCap } from "lucide-react";

type ItemRow = {
  key: string;
  id?: string;
  name: string;
  assignmentRate: string;
  mockRate: string;
  testRate: string;
};

type TutoringState = {
  hourlyRate: string;
  weeklyClasses: string;
  weeklyRate: string;
  monthlyDaysPerWeek: string;
  monthlyRate: string;
};

let rowSeq = 0;
const nextKey = () => `row-${Date.now()}-${rowSeq++}`;

const EMPTY_ITEM = (): ItemRow => ({ key: nextKey(), name: "", assignmentRate: "", mockRate: "", testRate: "" });

export default function SubjectPricingForm({
  subjectName,
  initialItems,
  initialTutoring,
}: {
  subjectName: string;
  initialItems: { id: string; name: string; assignmentRate: number; mockRate: number; testRate: number }[];
  initialTutoring: {
    hourlyRate: number | null;
    weeklyClasses: number | null;
    weeklyRate: number | null;
    monthlyDaysPerWeek: number | null;
    monthlyRate: number | null;
  } | null;
}) {
  const [items, setItems] = useState<ItemRow[]>(() =>
    initialItems.length
      ? initialItems.map((i) => ({
          key: i.id,
          id: i.id,
          name: i.name,
          assignmentRate: String(i.assignmentRate),
          mockRate: String(i.mockRate),
          testRate: String(i.testRate),
        }))
      : []
  );
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [tutoring, setTutoring] = useState<TutoringState>({
    hourlyRate: initialTutoring?.hourlyRate != null ? String(initialTutoring.hourlyRate) : "",
    weeklyClasses: initialTutoring?.weeklyClasses != null ? String(initialTutoring.weeklyClasses) : "",
    weeklyRate: initialTutoring?.weeklyRate != null ? String(initialTutoring.weeklyRate) : "",
    monthlyDaysPerWeek: initialTutoring?.monthlyDaysPerWeek != null ? String(initialTutoring.monthlyDaysPerWeek) : "",
    monthlyRate: initialTutoring?.monthlyRate != null ? String(initialTutoring.monthlyRate) : "",
  });
  const [saving, setSaving] = useState(false);

  function patchRow(key: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    const row = items.find((r) => r.key === key);
    if (row?.id) setDeletedIds((prev) => [...prev, row.id as string]);
    setItems((prev) => prev.filter((r) => r.key !== key));
  }

  function patchTutoring(patch: Partial<TutoringState>) {
    setTutoring((prev) => ({ ...prev, ...patch }));
  }

  async function save() {
    const cleaned = items
      .filter((r) => r.name.trim())
      .map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        name: r.name.trim(),
        assignmentRate: Number(r.assignmentRate) || 0,
        mockRate: Number(r.mockRate) || 0,
        testRate: Number(r.testRate) || 0,
      }));
    setSaving(true);
    try {
      const res = await fetch(window.location.pathname.replace(/^\/admin\//, "/api/admin/") + "/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cleaned,
          deletedIds,
          tutoring: {
            hourlyRate: tutoring.hourlyRate ? Number(tutoring.hourlyRate) : null,
            weeklyClasses: tutoring.weeklyClasses ? Number(tutoring.weeklyClasses) : null,
            weeklyRate: tutoring.weeklyRate ? Number(tutoring.weeklyRate) : null,
            monthlyDaysPerWeek: tutoring.monthlyDaysPerWeek ? Number(tutoring.monthlyDaysPerWeek) : null,
            monthlyRate: tutoring.monthlyRate ? Number(tutoring.monthlyRate) : null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not save pricing.");
        return;
      }
      setDeletedIds([]);
      toast.success("Pricing saved. Student quotations now use these rates.");
    } catch {
      toast.error("Could not save pricing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chapters / topics & rates — {subjectName}</CardTitle>
          <CardDescription>
            Students type these chapter/topic names (comma separated) when requesting services. The matching entry here
            determines the assignment, mock and real-test rate for that chapter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No chapters/topics priced yet. Add the ones students may choose from.</p>
          )}
          {items.map((row) => (
            <div key={row.key} className="grid grid-cols-2 items-center gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <Input
                value={row.name}
                onChange={(e) => patchRow(row.key, { name: e.target.value })}
                placeholder="Chapter / topic name, e.g. Triangles"
                className="col-span-2 sm:col-span-1"
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.assignmentRate}
                onChange={(e) => patchRow(row.key, { assignmentRate: e.target.value })}
                placeholder="₹ assignment"
                aria-label="Assignment rate"
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.mockRate}
                onChange={(e) => patchRow(row.key, { mockRate: e.target.value })}
                placeholder="₹ mock"
                aria-label="Mock test rate"
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.testRate}
                onChange={(e) => patchRow(row.key, { testRate: e.target.value })}
                placeholder="₹ real test"
                aria-label="Real test rate"
              />
              <Button variant="ghost" size="icon" className="justify-self-end text-destructive" onClick={() => removeRow(row.key)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, EMPTY_ITEM()])}>
            <Plus className="mr-1 h-4 w-4" /> Add chapter / topic
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4" /> Online tutoring rates — {subjectName}
          </CardTitle>
          <CardDescription>Three billing bases for learning-from-teacher. Fill the ones you offer.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Per hour</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={tutoring.hourlyRate}
                onChange={(e) => patchTutoring({ hourlyRate: e.target.value })}
                placeholder="Rate per hour"
              />
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Per week</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={tutoring.weeklyClasses}
                  onChange={(e) => patchTutoring({ weeklyClasses: e.target.value })}
                  placeholder="Classes/week"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={tutoring.weeklyRate}
                  onChange={(e) => patchTutoring({ weeklyRate: e.target.value })}
                  placeholder="₹/week"
                />
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Per month</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={tutoring.monthlyDaysPerWeek}
                  onChange={(e) => patchTutoring({ monthlyDaysPerWeek: e.target.value })}
                  placeholder="Days/week"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={tutoring.monthlyRate}
                  onChange={(e) => patchTutoring({ monthlyRate: e.target.value })}
                  placeholder="₹/month"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save pricing
        </Button>
      </div>
    </div>
  );
}