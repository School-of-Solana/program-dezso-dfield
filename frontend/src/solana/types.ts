import type { PublicKey } from "@solana/web3.js";
import type { BN } from "@coral-xyz/anchor";

export type EventAccount = {
  pubkey: PublicKey;
  price: BN;
  title: string;
  description: string;
  organizer: PublicKey;
  event_id: BN;
};

export type TicketAccount = {
  pubkey: PublicKey;
  event: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
  checked_in: boolean;
};