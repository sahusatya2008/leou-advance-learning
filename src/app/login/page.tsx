import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { LoginFlow } from "@/components/auth/LoginFlow";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[min(600px,110vw)] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Link href="/">
            <Brand className="scale-125" />
          </Link>
          <p className="text-sm text-muted-foreground">Assignments · Mock tests · Proctored exams</p>
        </div>
        <LoginFlow />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New student?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}