import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { revealPassword } from "@/lib/passwords";
import { Card, CardContent } from "@/components/ui/card";
import { StudentIdCard } from "@/components/student/StudentIdCard";
import { ProfileEditor } from "@/components/student/ProfileEditor";
import { ParentRegisterCard } from "@/components/student/ParentRegisterCard";
import { IdCard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
  const { user } = await requireRole("STUDENT");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { classRoom: true },
  });

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Your student profile is still being set up.
        </CardContent>
      </Card>
    );
  }

  const currentPassword = revealPassword(user.passwordEnc);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <IdCard className="h-6 w-6 text-primary" /> My profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Your identity card, contact details and parent access. Changes here appear on the admin&apos;s student page.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StudentIdCard
          data={{
            fullName: profile.fullName,
            username: user.username,
            classRoom: profile.classRoom.name,
            stream: profile.stream,
            schoolName: profile.schoolName,
            photoUrl: profile.facePhotoUrl,
            status: user.status,
            joined: user.createdAt,
          }}
        />
        <ParentRegisterCard />
      </div>

      <ProfileEditor
        data={{
          fullName: profile.fullName,
          username: user.username,
          email: user.email,
          phone: user.phone ?? "",
          classRoomName: profile.classRoom.name,
          hasStreams: profile.classRoom.hasStreams,
          stream: profile.stream ?? "",
          schoolName: profile.schoolName,
          schoolStatus: profile.schoolStatus,
          schoolClassHistory: profile.schoolClassHistory ?? "",
          currentPassword,
        }}
      />
    </div>
  );
}
