"use client";

import Header from "@/components/header";
import { Toaster } from "sonner";
import { UserSync } from "@/components/UserSync";
import ClerkClientProvider from "@/components/ClerkClientProvider";

export default function RootLayoutWrapper({ children }) {
  return (
    <ClerkClientProvider>
      <UserSync />
      <Header />
      <main className="min-h-screen pt-20">{children}</main>
      <Toaster richColors />
    </ClerkClientProvider>
  );
}
