"use client";

import { type ReactNode } from "react";
import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import { solana, solanaDevnet } from "@reown/appkit/networks";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

interface AppKitProviderProps {
  children: ReactNode;
}

const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ??
  process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) {
  console.warn(
    "NEXT_PUBLIC_REOWN_PROJECT_ID is not set. Reown auth may not work."
  );
}

// Get base URL for metadata - evaluated at runtime in the browser
// Priority: NEXT_PUBLIC_APP_URL env var > window.location.origin > localhost
const getBaseUrl = () => {
  // Explicit env var (set in Vercel) - available at build time
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // Runtime: use current origin (works in browser)
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // Build-time fallback (shouldn't be used in production)
  return "http://localhost:3000";
};

// Create metadata with dynamic URL
const createMetadata = () => {
  const baseUrl = getBaseUrl();
  return {
    name: "MediChat Assistant (Beta)",
    description: "AI-powered medical assistant",
    url: baseUrl,
    icons: [`${baseUrl}/favicon.ico`],
  };
};

const metadata = createMetadata();

const solanaAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
});

export const reownAppKit = createAppKit({
  adapters: [solanaAdapter],
  projectId: projectId ?? "",
  networks: [solana, solanaDevnet],
  defaultNetwork: solana,
  metadata,
  features: {
    email: true,
    socials: ["google", "apple"],
  },
});

export function AppKitProvider({ children }: AppKitProviderProps) {
  return <>{children}</>;
}
