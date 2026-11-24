"use client";

import { friendlyError, parseJson } from "@/lib/apiClient";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  Phone,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isLeouPayRefShape, upiDeepLink } from "@/lib/leouPay";
import { PaymentScanCamera } from "@/components/student/PaymentScanCamera";
import { PaymentCheckList } from "@/components/student/PaymentCheckList";
import type { PaymentCheckResult } from "@/lib/paymentVerification";

type Method = "TRANSACTION_ID" | "SCREENSHOT" | "CAMERA_SCAN";

type Attempt = {
  id: string;
  status: string;
  method: string;
  transactionId: string | null;
  decisionNote: string | null;
  submittedAt: string;
  attachments: string[];
};

const inrText = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

export function PayNowPanel(props: {
  requestId: string;
  leouPayRef: string;
  amount: number;
  grandTotal: number;
  status: string;
  upiId: string;
  payeeName: string;
  /** Data URL of the UPI QR, or null if it could not be drawn. */
  qrImage: string | null;
  /** Set when a configured QR artwork could not be found on disk. */
  qrWarning?: boolean;
  helpline: string;
  bankNote: string;
  attempts: Attempt[];
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("TRANSACTION_ID");
  const [txn, setTxn] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // The check shown for an uploaded screenshot, so the screenshot path answers
  // the same questions as the camera path before anything is sent.
  const [shotChecks, setShotChecks] = useState<PaymentCheckResult | null>(null);
  const [readingShot, setReadingShot] = useState(false);
  // What the server concluded when the proof was accepted. This is the one that
  // counts: the preview above is only the same read, not the record.
  const [verdict, setVerdict] = useState<PaymentCheckResult | null>(null);
  const [verdictNote, setVerdictNote] = useState<string | null>(null);

  const refValid = isLeouPayRefShape(props.leouPayRef);
  const pending = props.attempts.some((a) => a.status === "SUBMITTED");

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Could not copy - select the text and copy it manually.");
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setShot(dataUrl);
      setShotChecks(null);
      setError(null);
      // Read it straight away. Uploading a screenshot and being told "sent,
      // wait for the admin" with no indication of whether the amount is even
      // right is the worst of both, and the student can still fix a bad
      // screenshot while they are looking at it.
      void readShot(dataUrl);
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  }

  async function readShot(dataUrl: string) {
    setReadingShot(true);
    try {
      const res = await fetch("/api/student/payments/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, requestId: props.requestId }),
      });
      const data = await parseJson<{
        ok?: boolean;
        error?: string;
        transactionId?: string;
        verification?: PaymentCheckResult | null;
      }>(res);
      if (data?.verification) setShotChecks(data.verification);
      if (data?.transactionId) setTxn(data.transactionId);
    } catch {
      setError("Could not read that screenshot. You can still send it for the admin to check.");
    } finally {
      setReadingShot(false);
    }
  }

  async function send(body: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/student/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: props.requestId, ...body }),
      });
      const data = await parseJson<{
        error?: string;
        verification?: PaymentCheckResult | null;
        scanError?: string | null;
      }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Could not send your payment proof.");
      // The server re-reads the image itself, so this is the check that was
      // actually recorded - not the preview the browser did earlier.
      setVerdict(data.verification ?? null);
      setVerdictNote(data.scanError ?? null);
      setSent(true);
      router.refresh();
    } catch (e) {
      setError(friendlyError(e, "Could not start the payment. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (method === "TRANSACTION_ID" && txn.trim().length < 6) {
      setError("Enter the transaction id your UPI app shows you.");
      return;
    }
    if (method === "SCREENSHOT" && !shot) {
      setError("Choose the payment screenshot first.");
      return;
    }
    await send({ method, transactionId: txn.trim(), screenshot: shot });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pay Now</h1>
        <p className="text-sm text-muted-foreground">
          Pay by UPI or PhonePe, then confirm it below. Your services start as soon as the
          admin verifies the payment.
        </p>
      </div>

      {/* The reference has to be captured before the money moves, so it leads. */}
      <Card className="glass border-primary/30">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Your SNSX powered LEOU payment id
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-muted px-4 py-2 text-xl font-bold tracking-[0.2em]">
              {refValid ? props.leouPayRef : "—"}
            </code>
            {refValid && (
              <Button variant="ghost" size="sm" onClick={() => copy(props.leouPayRef, "ref")}>
                {copied === "ref" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "ref" ? "Copied" : "Copy"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Note this down before you pay. It is how the admin matches your payment to your
            account, so quote it if you ever call.
          </p>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Amount payable</span>
            <span className="text-2xl font-bold text-primary">{inrText(props.grandTotal || props.amount)}</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-[auto,1fr]">
            <div className="rounded-xl border border-border bg-background/40 p-3">
              {props.qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={props.qrImage}
                  alt="UPI QR code to scan and pay"
                  className="h-44 w-44 rounded-lg bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center rounded-lg bg-white p-3 text-center text-xs text-black">
                  Could not generate a QR code. Please pay using the UPI id shown here.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">UPI id</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-sm">{props.upiId}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(props.upiId, "upi")}>
                    {copied === "upi" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Paying as</p>
                <p className="text-sm">{props.payeeName}</p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm">
                  <a
                    href={upiDeepLink({
                      upiId: props.upiId,
                      payeeName: props.payeeName,
                      amount: props.grandTotal || props.amount,
                      note: `${props.bankNote} ${props.leouPayRef}`,
                    })}
                  >
                    <QrCode className="h-4 w-4" /> Pay {inrText(props.grandTotal || props.amount)} with UPI app
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${props.helpline.replace(/\s/g, "")}`}>
                    <Phone className="h-4 w-4" /> {props.helpline}
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Prefer the button over the QR? It fills in the amount and puts{" "}
                <span className="font-medium text-foreground">{props.leouPayRef}</span> in the
                note, so the payment lands in our account already labelled with your reference.
                A scanned QR only identifies the account, so type the amount in yourself.
                Paying by phone? Call the number above and read out your LEOU payment id.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {props.attempts.length > 0 && (
        <Card className="glass">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-medium">Your payment attempts</h2>
            {props.attempts.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">
                    {a.method === "TRANSACTION_ID" ? "Transaction id" : a.method === "SCREENSHOT" ? "Screenshot" : "Camera scan"}
                    {a.transactionId ? ` · ${a.transactionId}` : ""}
                  </span>
                  <Badge
                    className={
                      a.status === "APPROVED"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : a.status === "REJECTED"
                          ? "bg-red-500/20 text-red-300"
                          : a.status === "SUPERSEDED"
                            ? "bg-muted text-muted-foreground"
                            : "bg-amber-500/20 text-amber-300"
                    }
                  >
                    {a.status}
                  </Badge>
                </div>
                {a.decisionNote && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Admin:</span> {a.decisionNote}
                  </p>
                )}
                {a.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.attachments.map((u) => (
                      <a
                        key={u}
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline"
                      >
                        attachment
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {scanning ? (
        <PaymentScanCamera
          requestId={props.requestId}
          submitting={busy}
          error={error}
          onCancel={() => {
            setScanning(false);
            setError(null);
          }}
          onSubmit={async (payload) => {
            await send({ method: "CAMERA_SCAN", ...payload });
            setScanning(false);
          }}
        />
      ) : (
      <Card className="glass">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-medium">Confirm your payment</h2>

          {pending ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-300" />
              <div>
                <p className="text-sm font-medium">Waiting for the admin</p>
                <p className="text-sm text-muted-foreground">
                  Your proof is with the admin. You will see the decision here - and your
                  services will switch on automatically if it is approved.
                </p>
              </div>
            </div>
          ) : sent ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                <p className="text-sm">Sent. The admin will verify it shortly.</p>
              </div>
              {verdictNote && (
                <p className="text-xs text-muted-foreground">
                  We could not read the screen automatically ({verdictNote}) - the admin will check
                  it against your proof by hand.
                </p>
              )}
              {verdict && <PaymentCheckList checks={verdict} />}
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <MethodButton
                  active={method === "TRANSACTION_ID"}
                  onClick={() => setMethod("TRANSACTION_ID")}
                  icon={<Smartphone className="h-4 w-4" />}
                  title="Transaction id"
                  hint="Type the id"
                />
                <MethodButton
                  active={method === "SCREENSHOT"}
                  onClick={() => setMethod("SCREENSHOT")}
                  icon={<Upload className="h-4 w-4" />}
                  title="Screenshot"
                  hint="Upload proof"
                />
                <MethodButton
                  active={method === "CAMERA_SCAN"}
                  onClick={() => setMethod("CAMERA_SCAN")}
                  icon={<ScanLine className="h-4 w-4" />}
                  title="Camera scan"
                  hint="Show on camera"
                />
              </div>

              {method === "TRANSACTION_ID" && (
                <input
                  value={txn}
                  onChange={(e) => setTxn(e.target.value)}
                  placeholder="e.g. 428193756201"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              )}

              {method === "SCREENSHOT" && (
                <div className="space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                  <Button variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Choose screenshot
                  </Button>
                  {shot && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shot} alt="Payment screenshot" className="max-h-40 rounded-lg border border-border" />
                  )}
                  {readingShot && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your screenshot…
                    </p>
                  )}
                  {shotChecks && <PaymentCheckList checks={shotChecks} />}
                </div>
              )}

              {method === "CAMERA_SCAN" && (
                <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  The SNSX scanning camera reads the transaction id off your payment
                  confirmation, then shows it back for you to check before anything is sent.
                </p>
              )}

              {error && (
                <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {error}
                </p>
              )}

              <Button
                onClick={() => (method === "CAMERA_SCAN" ? setScanning(true) : submit())}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {method === "CAMERA_SCAN" ? "Open the scanner" : "Send for verification"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}

function MethodButton(props: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-lg border p-3 text-left transition ${
        props.active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {props.icon}
        {props.title}
      </span>
      <span className="text-xs text-muted-foreground">{props.hint}</span>
    </button>
  );
}
