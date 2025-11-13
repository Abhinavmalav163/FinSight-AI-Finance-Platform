"use client";

import { ClerkProvider } from "@clerk/nextjs";

export default function ClerkClientProvider({ children }) {
  // Keep this minimal: ensures Clerk's client-side provider is only used
  // inside a true client component and not invoked during server rendering.
  return <ClerkProvider>{children}</ClerkProvider>;
}
