import React, { useState } from "react";
import "./HeaderBar.scss";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

type Props = {
  programId: string;
};

const HeaderBar: React.FC<Props> = ({ programId }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(programId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
    }
  };

  const shortProgramId =
    programId.length > 16
      ? `${programId.slice(0, 6)}…${programId.slice(-6)}`
      : programId;

  return (
    <header className="header-bar">
      <div className="header-bar__left">
        <div className="header-bar__title-row">
          <div className="header-bar__logo-circle">🎟</div>
          <div>
            <h1 className="header-bar__title">Solana Event dApp - DField Solutions</h1>
            <p className="header-bar__subtitle">
              Devnet · Create events, mint ticket NFTs, check in & withdraw
            </p>
          </div>
        </div>

        <div className="header-bar__meta">
          <span className="header-bar__pill header-bar__pill--env">
            Devnet
          </span>

          <button
            className="header-bar__program"
            type="button"
            onClick={handleCopy}
          >
            <span className="header-bar__program-label">Program</span>
            <span className="header-bar__program-id">{shortProgramId}</span>
            <span className="header-bar__program-copy">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
        </div>
      </div>

      <div className="header-bar__right">
        <WalletMultiButton className="header-bar__wallet-button" />
      </div>
    </header>
  );
};

export default HeaderBar;