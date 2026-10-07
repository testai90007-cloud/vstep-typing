'use client';

// Wraps the app in next-auth's SessionProvider so client components
// can use useSession() / signIn() / signOut().

import { SessionProvider } from 'next-auth/react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
