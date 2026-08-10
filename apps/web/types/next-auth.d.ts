import type { SessionUser } from "@virtelon/types";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & SessionUser;
  }

  interface User extends SessionUser {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends Partial<SessionUser> {}
}
