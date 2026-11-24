import { DoubtInbox } from "@/components/admin/practical/DoubtInbox";

export const dynamic = "force-dynamic";

/** Doubts students raised from inside a practical, with an inline answer box. */
export default function PracticalDoubtsPage() {
  return <DoubtInbox />;
}
