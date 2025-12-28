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

const metadata = {
  name: "MediChat Assistant",
  description: "AI-powered medical assistant",
  url: "http://localhost:3000",
  icons: ["http://localhost:3000/favicon.ico"],
};

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
