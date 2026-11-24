"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Fingerprint, Loader2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  FaceSampleCapture,
  type FaceSampleMode,
} from "@/components/face/FaceSampleCapture";
import { FACE_CONFIG } from "@/lib/constants";

export default function FaceReEnrollButton({ studentUserId }: { studentUserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPhotos, setLastPhotos] = useState<string[] | null>(null);

  async function enroll(photos: string[], mode: FaceSampleMode) {
    setLastPhotos(photos);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${studentUserId}/face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: photos, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Face enrollment failed.");
        return;
      }
      toast.success(
        `Face re-enrolled with ${data.samples} AI samples. The student can now log in with a live face match.`
      );
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setLastPhotos(null);
          setOpen(true);
        }}
      >
        <Fingerprint className="h-4 w-4" /> Enroll / Re-enroll face
      </Button>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-accent" /> AI face enrollment for this student
          </DialogTitle>
          <DialogDescription>
            Provide {FACE_CONFIG.ENROLL_SAMPLES} clear samples (minimum 3). You can take live
            captures with the camera or upload clear face photos of the student. The system formats
            every sample into ArcFace embeddings with InsightFace and runs DeepFace anti-spoofing —
            face login then requires a live match.
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/50 py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">
              Analyzing samples with InsightFace + DeepFace…
            </p>
          </div>
        ) : lastPhotos && error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button className="w-full" size="lg" onClick={() => enroll(lastPhotos, "mixed")} disabled={busy}>
              Retry with these {lastPhotos.length} photos
            </Button>
          </div>
        ) : (
          <FaceSampleCapture onComplete={enroll} />
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}