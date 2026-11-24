import { InviteLanding } from "@/components/chess/InviteLanding";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/**
 * Public invitation landing. Deliberately outside the dashboard shell so a
 * friend with no account can follow the link, read who invited them, and get
 * sent to register or sign in — no login wall in front of the invitation.
 */
export default async function ChessJoinPage({ params }: Params) {
  const { token } = await params;
  return <InviteLanding token={token} />;
}
