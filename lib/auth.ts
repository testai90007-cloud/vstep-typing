// ---------------------------------------------------------------------------
// Auth.js v5 (next-auth) configuration — Google OAuth.
// Env vars required:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (Google Cloud Console OAuth client)
//   AUTH_SECRET                              (any random 32+ char string)
// On Vercel, host detection is automatic.
// ---------------------------------------------------------------------------

import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';

// Fail fast at import when a required env var is missing, with the var
// named — instead of a cryptic Auth.js runtime error on first login.
const REQUIRED_ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'AUTH_SECRET'] as const;
for (const name of REQUIRED_ENV) {
  if (!process.env[name]) {
    throw new Error(
      `[auth] Missing required env var ${name}. Copy .env.example to .env.local and fill it in.`
    );
  }
}

declare module 'next-auth' {
  interface Session {
    user: {
      /** Google `sub` — stable user id, used as users.id in the database. */
      id: string;
    } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Auth.js v5 mints user.id as a RANDOM UUID on every OAuth login and
      // uses it for token.sub — that orphaned all saved progress on re-login.
      // Pin the subject to the stable Google `sub` instead.
      if (account?.providerAccountId) {
        token.sub = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose the stable Google `sub` as session.user.id for DB lookups.
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
