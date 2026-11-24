import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { StudentRegisterWizard } from "@/components/register/StudentRegisterWizard";

export const metadata: Metadata = { title: "Student registration" };

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[min(600px,110vw)] -translate-x-1/2 rounded-full bg-cyan-600/10 blur-3xl" />
      <div className="relative w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Link href="/">
            <Brand className="scale-125" />
          </Link>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
        <StudentRegisterWizard />
      </div>
    </div>
  );
}