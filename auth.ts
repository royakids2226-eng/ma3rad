import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        code: { label: "Code", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.code || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { code: credentials.code },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) return null;

        // Return the user object with the role included
        return {
          id: user.id,
          name: user.name,
          email: user.code,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // If the user object is available (on sign-in), add the role to the token
      if (user) {
        token.id = user.id;
        token.name = user.name;
        // @ts-ignore
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // Restore the original workaround for storing user ID in `image` field
        // @ts-ignore
        session.user.image = token.id;
        session.user.name = token.name;
        session.user.email = token.email; // This is the user code

        // Add the role to the session from the token
        // @ts-ignore
        session.user.role = token.role;
      }
      return session;
    },
  },
};
