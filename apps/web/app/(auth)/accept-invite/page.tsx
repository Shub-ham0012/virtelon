import { rawPrisma } from "@virtelon/db";
import { verifyInviteToken } from "@/lib/invite-token";
import { AcceptInviteForm } from "./accept-invite-form";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <p className="text-sm text-(--danger)">Missing invite token.</p>;
  }

  const verified = await verifyInviteToken(token);
  if (!verified) {
    return <p className="text-sm text-(--danger)">This invite link is invalid or has expired.</p>;
  }

  const membership = await rawPrisma.membership.findUnique({
    where: { id: verified.membershipId },
    include: { organization: true },
  });

  if (!membership) {
    return <p className="text-sm text-(--danger)">This invite link is invalid or has expired.</p>;
  }
  if (membership.joinedAt) {
    return <p className="text-sm text-(--sub)">This invite has already been accepted — please sign in.</p>;
  }

  return <AcceptInviteForm token={token} organizationName={membership.organization.name} role={membership.role} />;
}
