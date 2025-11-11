import React, { useMemo } from "react";
import "./styles/global.scss";
import "@solana/wallet-adapter-react-ui/styles.css";

import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

import { DEVNET_ENDPOINT } from "./solana/config";
import AppLayout from "./components/layout/AppLayout";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

const App: React.FC = () => {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={DEVNET_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppLayout />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;