import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Lightweight NextAuth instance (no Prisma/bcrypt) for the proxy/middleware.
export const { auth } = NextAuth(authConfig);
