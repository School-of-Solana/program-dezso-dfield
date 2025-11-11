import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, type Idl } from "@coral-xyz/anchor";
import idlJson from "../idl.json";

export const FULL_IDL = idlJson as Idl;

export const PROGRAM_ID = new PublicKey(FULL_IDL.address);

export const DEVNET_ENDPOINT =
  import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl("devnet");

export const connection = new Connection(DEVNET_ENDPOINT, "confirmed");

export const LAMPORTS_PER_SOL = 1_000_000_000;

export const coder = new BorshCoder(FULL_IDL);

export const EVENT_DISCRIMINATOR_BYTES = new Uint8Array(
  (FULL_IDL.accounts!.find((a) => a.name === "Event")!.discriminator ??
    []) as number[]
);

export const TICKET_DISCRIMINATOR_BYTES = new Uint8Array(
  (FULL_IDL.accounts!.find((a) => a.name === "Ticket")!.discriminator ??
    []) as number[]
);