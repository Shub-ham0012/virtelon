import { SignJWT, jwtVerify } from "jose";
import { env } from "@virtelon/config";

const secret = new TextEncoder().encode(env.AUTH_SECRET);
const INVITE_TTL = "7d";

export async function signInviteToken(membershipId: string): Promise<string> {
  return new SignJWT({ membershipId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(INVITE_TTL)
    .sign(secret);
}

export async function verifyInviteToken(token: string): Promise<{ membershipId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.membershipId !== "string") return null;
    return { membershipId: payload.membershipId };
  } catch {
    return null;
  }
}
