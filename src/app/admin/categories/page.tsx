import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Layers, Users, Settings2, Plus } from "lucide-react";
import ClassForm from "@/components/admin/classes/ClassForm";
import ClassActions from "@/components/admin/classes/ClassActions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const classes = await prisma.classRoom.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { students: true, batches: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Category Management</h1>
          <p className="text-sm text-muted-foreground">Classes define the school structure; batches are sections inside a class.</p>
        </div>
        <ClassForm />
      </div>

      {classes.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
              <Layers className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">No classes yet. Create your first class to get started.</p>
            <ClassForm trigger={<Button size="sm"><Plus className="h-4 w-4" /> Add class</Button>} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id} className="glass">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {cls.name}
<Badge variant={cls.isActive ? "default" : "secondary"}>
                {cls.isActive ? "Active" : "Inactive"}
              </Badge>
            </CardTitle>
            <ClassActions
              cls={{
                id: cls.id,
                name: cls.name,
                hasStreams: cls.hasStreams,
                sortOrder: cls.sortOrder,
                active: cls.isActive,
              }}
            />
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-4 text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {cls._count.students} students</span>
                  <span className="flex items-center gap-1.5"><Layers className="h-4 w-4" /> {cls._count.batches} batches</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2">
                  <span className="text-muted-foreground">Has streams (Science/Commerce)</span>
                  <span className="font-medium">{cls.hasStreams ? "Yes" : "No"}</span>
                </div>
                <Link href={`/admin/categories/${cls.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    <Settings2 className="h-4 w-4" /> Manage class
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}