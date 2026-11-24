"use client";

import { friendlyError, parseJson } from "@/lib/apiClient";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Paperclip, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Approve or reject a payment.
 *
 * Rejecting requires a written reason because the student sees it verbatim, and
 * accepts up to four screenshots so the admin can show the mismatch rather than
 * just describe it. Approving needs no note but allows one.
 */
export function PaymentDecision({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"APPROVE" | "REJECT" | null>(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const readers = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 4 - files.length)
      .map(
        (f) =>
          new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => resolve("");
            r.readAsDataURL(f);
          })
      );
    Promise.all(readers).then((urls) => setFiles((prev) => [...prev, ...urls.filter(Boolean)]));
  }

  async function decide(decision: "APPROVE" | "REJECT") {
    if (decision === "REJECT" && !note.trim()) {
      setError("Tell the student why this was rejected - they will see this message.");
      return;
    }
    setError(null);
    setBusy(decision);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim(), attachments: files }),
      });
      const data = await parseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Could not record that decision.");
      router.refresh();
    } catch (e) {
      setError(friendlyError(e, "Could not record that decision. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="glass">
      <CardContent className="space-y-4 p-6">
        <h2 className="text-sm font-medium">Your decision</h2>

        <div>
          <label className="text-xs text-muted-foreground" htmlFor="decision-note">
            Message to the student (required when rejecting)
          </label>
          <textarea
            id="decision-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. The amount received was ₹1,200 but the quotation is ₹1,234.50. Please pay the difference and resubmit."
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Attach
            </Button>
            {files.map((f, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" /> {i + 1}
                <button
                  type="button"
                  onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                  className="text-destructive"
                  aria-label={`Remove attachment ${i + 1}`}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => decide("APPROVE")}
            disabled={busy !== null}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {busy === "APPROVE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve &amp; activate services
          </Button>
          <Button
            variant="outline"
            onClick={() => decide("REJECT")}
            disabled={busy !== null}
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            {busy === "REJECT" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
