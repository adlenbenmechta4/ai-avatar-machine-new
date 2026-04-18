import type { NextAuthOptions } from "next-auth";

export const authConfig: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
};
