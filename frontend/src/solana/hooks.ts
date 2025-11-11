import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EVENT_DISCRIMINATOR_BYTES,
  TICKET_DISCRIMINATOR_BYTES,
  coder,
  connection,
  FULL_IDL,
  PROGRAM_ID,
} from "./config";
import type { EventAccount, TicketAccount } from "./types";
import bs58 from "bs58";
import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
export function useProgram() {
  const wallet = useWallet();

  return useMemo(() => {
    if (!wallet || !wallet.publicKey) return null;

    const provider = new AnchorProvider(connection, wallet as any, {
      preflightCommitment: "confirmed",
    });

    return new Program(FULL_IDL as Idl, provider);
  }, [wallet]);
}

export function useEvents() {
  const [events, setEvents] = useState<EventAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: bs58.encode(EVENT_DISCRIMINATOR_BYTES),
            },
          },
        ],
      });

      const decoded: EventAccount[] = accounts.map((acc) => {
        const data: any = coder.accounts.decode("Event", acc.account.data);
        return {
          pubkey: acc.pubkey,
          price: data.price as BN,
          title: data.title as string,
          description: data.description as string,
          organizer: data.organizer as PublicKey,
          event_id: data.event_id as BN,
        };
      });

      setEvents(decoded);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { events, loading, error, refresh };
}

export function useTickets(ownerFilter?: PublicKey) {
  const [tickets, setTickets] = useState<TicketAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ownerFilter) {
      setTickets([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: bs58.encode(TICKET_DISCRIMINATOR_BYTES),
            },
          },
          {
            memcmp: {
              offset: 8 + 32,
              bytes: ownerFilter.toBase58(),
            },
          },
        ],
      });

      const decoded: TicketAccount[] = accounts.map((acc) => {
        const data: any = coder.accounts.decode("Ticket", acc.account.data);
        return {
          pubkey: acc.pubkey,
          event: data.event as PublicKey,
          owner: data.owner as PublicKey,
          mint: data.mint as PublicKey,
          checked_in: data.checked_in as boolean,
        };
      });

      setTickets(decoded);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  }, [ownerFilter]);

  useEffect(() => {
    if (ownerFilter) {
      refresh();
    } else {
      setTickets([]);
    }
  }, [ownerFilter, refresh]);

  return { tickets, loading, error, refresh };
}