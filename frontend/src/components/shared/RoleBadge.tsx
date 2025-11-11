import React from "react";
import "./RoleBadge.scss";
import type { PublicKey } from "@solana/web3.js";
import type { EventAccount } from "../../solana/types";

type Props = {
  wallet: PublicKey | null;
  event: EventAccount;
  hasTicket?: boolean;
};

const RoleBadge: React.FC<Props> = ({ wallet, event, hasTicket }) => {
  if (!wallet) return null;

  const isOrganizer = event.organizer.equals(wallet);
  if (!isOrganizer && !hasTicket) {
    return null;
  }

  const roleLabel = isOrganizer ? "Organizer" : "Attendee";

  return (
    <span
      className={`role-badge ${
        isOrganizer ? "role-badge--organizer" : "role-badge--attendee"
      }`}
    >
      <span className="role-badge__dot" />
      <span className="role-badge__label">{roleLabel}</span>
    </span>
  );
};

export default RoleBadge;