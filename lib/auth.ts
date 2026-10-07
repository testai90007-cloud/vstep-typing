// ---------------------------------------------------------------------------
// Auth.js v5 (next-auth) configuration — Google OAuth.
// Env vars required:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (Google Cloud Console OAuth client)
//   AUTH_SECRET                              (any random 32+ char string)
// On Vercel, host detection is automatic.
// ---------------------------------------------------------------------------

import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';

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
    async session({ session, token }) {
      // Expose the Google `sub` as session.user.id for DB lookups.
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
