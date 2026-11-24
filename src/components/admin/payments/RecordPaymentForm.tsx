"use client";

import { friendlyError, parseJson } from "@/lib/apiClient";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Records a payment the admin has matched in the academy's UPI statement.
 *
 * The student's reference is the thing being reconciled, so the admin types the
 * bank entry's transaction id here and the app opens the normal verify screen.
 * This does not approve anything - it only puts the payment in front of the
 * admin, where the usual approve/reject decision switches the services on.
 */
export function RecordPaymentForm({
  requestId,
  amountLabel,
}: {
  requestId: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [txn, setTxn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (txn.trim().length < 6) {
      setError("Enter the transaction id from your UPI statement.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/payments/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, transactionId: txn.trim(), note: note.trim() }),
      });
      const data = await parseJson<{ error?: string; paymentId?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Could not record that payment.");
      if (!data?.paymentId) throw new Error("The payment was recorded but could not be opened.");
      // Land on the ordinary verify screen: the admin still has to confirm
      // before anything is activated.
      router.push(`/admin/payments/${data.paymentId}`);
    } catch (e) {
      setError(friendlyError(e, "Could not record that payment. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="glass border-primary/30">
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="text-sm font-medium">Record the payment you received</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Match the reference above in your UPI/PhonePe statement, then enter its transaction id.
            The payment opens on the verify screen where you approve it - recording it does not
            activate anything by itself.
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground" htmlFor="record-txn">
            UPI transaction id
          </label>
          <input
            id="record-txn"
            value={txn}
            onChange={(e) => setTxn(e.target.value)}
            placeholder="e.g. 428193756201"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground" htmlFor="record-note">
            Note (optional)
          </label>
          <textarea
            id="record-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Received in the academy UPI account on this month's statement."
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Record {amountLabel} &amp; open verification
        </Button>
      </CardContent>
    </Card>
  );
}
