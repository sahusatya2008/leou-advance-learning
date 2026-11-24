import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, HelpCircle, Code2, Table2, Mic, ImagePlus, FileText, Search, X } from "lucide-react";
import QuestionForm from "@/components/admin/questions/QuestionForm";
import QuestionActions from "@/components/admin/questions/QuestionActions";
import { Input } from "@/components/ui/input";
import type { QuestionType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const TYPE_ICONS: Record<string, { icon: typeof HelpCircle; label: string }> = {
  MCQ: { icon: HelpCircle, label: "MCQ" },
  SHORT: { icon: FileText, label: "Short answer" },
  LONG: { icon: FileText, label: "Long answer" },
  CODING: { icon: Code2, label: "Coding" },
  SQL: { icon: Table2, label: "SQL" },
  ORAL: { icon: Mic, label: "Oral" },
  UPLOAD: { icon: ImagePlus, label: "Photo / upload" },
};

const DIFFICULTY_STYLE: Record<string, string> = {
  EASY: "bg-emerald-500/15 text-emerald-300",
  MEDIUM: "bg-amber-500/15 text-amber-300",
  HARD: "bg-red-500/15 text-red-300",
};

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; classRoomId?: string; subjectId?: string; topic?: string }>;
}) {
  const { q, type, classRoomId, subjectId, topic } = await searchParams;

  const [questions, classes, classesWithSubjects, subjects, pricingTopics, questionTopics] = await Promise.all([
    prisma.question.findMany({
      where: {
        ...(type ? { type: type as QuestionType } : {}),
        ...(classRoomId ? { classRoomId } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(topic ? { topic } : {}),
        ...(q ? { stem: { contains: q, mode: "insensitive" } } : {}),
      },
      include: {
        classRoom: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        options: { orderBy: { sortOrder: "asc" } },
        testCases: { orderBy: { sortOrder: "asc" } },
        _count: { select: { inAssessments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.classRoom.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.classRoom.findMany({
      include: {
        subjects: { include: { subject: { select: { id: true, name: true } } }, orderBy: { subject: { name: "asc" } } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
    prisma.subjectPricingItem.findMany({
      select: { subjectId: true, name: true },
      distinct: ["subjectId", "name"],
      orderBy: { name: "asc" },
    }),
    prisma.question.findMany({
      select: { subjectId: true, topic: true },
      where: { topic: { not: null } },
      distinct: ["subjectId", "topic"],
    }),
  ]);

  const formClasses = classesWithSubjects.map((c) => ({
    id: c.id,
    name: c.name,
    hasStreams: c.hasStreams,
    subjects: c.subjects.map((s) => ({ id: s.subject.id, name: s.subject.name })),
  }));

  const topicsBySubject = pricingTopics.reduce<{ subjectId: string; topics: string[] }[]>((acc, p) => {
    const existing = acc.find((t) => t.subjectId === p.subjectId);
    if (existing) existing.topics.push(p.name);
    else acc.push({ subjectId: p.subjectId, topics: [p.name] });
    return acc;
  }, []);

  for (const qt of questionTopics) {
    const entry = topicsBySubject.find((t) => t.subjectId === qt.subjectId);
    if (entry) {
      if (!entry.topics.includes(qt.topic!)) entry.topics.push(qt.topic!);
    } else {
      topicsBySubject.push({ subjectId: qt.subjectId, topics: [qt.topic!] });
    }
  }

  const topicOptions = subjectId
    ? topicsBySubject.find((t) => t.subjectId === subjectId)?.topics ?? pricingTopics.map((p) => p.name)
    : [...new Set(topicsBySubject.flatMap((t) => t.topics))].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-sm text-muted-foreground">
            Author questions across all types — each tied to a class and subject.
          </p>
        </div>
        <QuestionForm classes={formClasses} topicsBySubject={topicsBySubject} />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" placeholder="Search question text" className="pl-9" defaultValue={q ?? ""} />
        </div>
        <FilterSelect name="type" placeholder="Type" defaultValue={type}
          options={[
            { value: "", label: "All types" },
            { value: "MCQ", label: "MCQ" },
            { value: "SHORT", label: "Short answer" },
            { value: "LONG", label: "Long answer" },
            { value: "CODING", label: "Coding" },
            { value: "SQL", label: "SQL" },
            { value: "ORAL", label: "Oral" },
            { value: "UPLOAD", label: "Photo / upload" },
          ]}
        />
        <FilterSelect name="classRoomId" placeholder="Class" defaultValue={classRoomId}
          options={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <FilterSelect name="subjectId" placeholder="Subject" defaultValue={subjectId}
          options={[{ value: "", label: "All subjects" }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <FilterSelect name="topic" placeholder="Chapter / topic" defaultValue={topic}
          options={[{ value: "", label: "All chapters" }, ...topicOptions.map((t) => ({ value: t, label: t }))]}
        />
        <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Filter
        </button>
        <a
          href="/admin/questions"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" /> Clear
        </a>
      </form>

      <Card className="glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="min-w-[260px]">Question</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Chapter / topic</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Parts</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
                      <Database className="h-6 w-6" />
                    </div>
                    <p className="text-sm">No questions yet. Create your first question above.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {questions.map((question) => {
              const cfg = TYPE_ICONS[question.type];
              const Icon = cfg?.icon ?? HelpCircle;
              return (
                <TableRow key={question.id}>
                  <TableCell>
                    <Badge variant="outline" className="gap-1.5 whitespace-nowrap">
                      <Icon className="h-3.5 w-3.5" /> {cfg?.label ?? question.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[340px]">
                    <p className="line-clamp-2 text-sm">{question.stem}</p>
                  </TableCell>
                  <TableCell className="text-sm">{question.classRoom.name}</TableCell>
                  <TableCell className="text-sm">{question.subject.name}</TableCell>
                  <TableCell className="text-sm">
                    {question.topic ? (
                      <Badge variant="outline">{question.topic}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {((question.tags as string[] | null) ?? []).map((t) => (
                      <Badge key={t} variant="secondary" className="ml-1">
                        {t}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Badge className={DIFFICULTY_STYLE[question.difficulty] ?? "bg-secondary"}>{question.difficulty}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {question.type === "MCQ" && `${question.options.length} options`}
                    {question.type === "CODING" && `${question.testCases.length} test cases`}
                    {question.type === "SQL" && "schema + result"}
                    {!["MCQ", "CODING", "SQL"].includes(question.type) && "—"}
                    <span className="ml-2 rounded bg-secondary px-1.5 py-0.5">in {question._count.inAssessments}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <QuestionActions question={question} classes={formClasses} topicsBySubject={topicsBySubject} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function FilterSelect({
  name,
  placeholder,
  defaultValue,
  options,
}: {
  name: string;
  placeholder: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
      aria-label={placeholder}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}