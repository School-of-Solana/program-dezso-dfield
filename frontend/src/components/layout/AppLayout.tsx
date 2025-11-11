import React, { useState, useEffect } from "react";
import "./AppLayout.scss";

import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair,
} from "@solana/web3.js";

import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { useProgram, useEvents, useTickets } from "../../solana/hooks";
import {
  LAMPORTS_PER_SOL,
  PROGRAM_ID,
  connection,
} from "../../solana/config";
import { utf8, bnToLe8 } from "../../solana/utils";
import type { TicketAccount, EventAccount } from "../../solana/types";

import HeaderBar from "./HeaderBar";
import StatusBanner from "./StatusBanner";
import EventsPanel from "../panels/EventsPanel";
import TicketsPanel from "../panels/TicketsPanel";
import CreateEventCard from "../forms/CreateEventCard";
import JoinEventCard from "../forms/JoinEventCard";
import WithdrawCard from "../forms/WithdrawCard";
import EventDetailsPanel from "../panels/EventDetailsPanel";

type MainTab = "explore" | "tickets" | "manage";
type ManageTab = "create" | "join" | "withdraw";

const extractTicketAddressFromInput = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const ticketParam = url.searchParams.get("ticket");
      return ticketParam ? ticketParam.trim() : null;
    } catch (e) {
      console.warn("[checkin] Failed to parse URL from scanned value", e);
      return null;
    }
  }
  if (trimmed.includes("ticket=")) {
    const idx = trimmed.indexOf("ticket=");
    const after = trimmed.slice(idx + "ticket=".length);
    const ticketCandidate = after.split(/[&#?\s]/)[0];
    return ticketCandidate.trim() || null;
  }

  return trimmed;
};

const AppLayout: React.FC = () => {
  const wallet = useWallet();
  const program = useProgram();

  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    refresh: refreshEvents,
  } = useEvents();

  const {
    tickets,
    loading: ticketsLoading,
    error: ticketsError,
    refresh: refreshTickets,
  } = useTickets(wallet.publicKey ?? undefined);

  const connected = !!wallet.publicKey;
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const [mainTab, setMainTab] = useState<MainTab>("explore");
  const [manageTab, setManageTab] = useState<ManageTab>("create");

  const [selectedEvent, setSelectedEvent] = useState<EventAccount | null>(null);

  const [deepLinkTicket, setDeepLinkTicket] = useState<string | null>(null);
  const [deepLinkEventPubkey, setDeepLinkEventPubkey] =
    useState<PublicKey | null>(null);

  const handleError = (e: any) => {
    console.error("Raw error object:", e);
    const logs = e?.logs ?? e?.error?.logs;
    if (logs) {
      console.error("Program logs:", logs);
    }

    const baseMsg = e?.error?.message ?? e?.message ?? "Transaction failed";

    const hint = logs ? " (see console for program logs)" : "";
    setTxStatus(`❌ ${baseMsg}${hint}`);
  };

  const generateEventIdBn = (): BN => {
    return new BN(Date.now().toString());
  };

  const deriveEventPdaFromSigner = (signer: PublicKey, eventId: BN) => {
    const [pda] = PublicKey.findProgramAddressSync(
      [utf8("event"), signer.toBytes(), bnToLe8(eventId)],
      PROGRAM_ID
    );
    return pda;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const url = new URL(window.location.href);
      const ticketParam = url.searchParams.get("ticket");
      if (ticketParam) {
        setDeepLinkTicket(ticketParam.trim());
        setMainTab("explore");
      }
    } catch (e) {
      console.warn("[checkin] Failed to parse ticket from URL", e);
    }
  }, []);

  useEffect(() => {
    if (!program || !deepLinkTicket) return;

    (async () => {
      try {
        const ticketPubkey = new PublicKey(deepLinkTicket);
        const ticketAcc: any = await (program.account as any).ticket.fetch(
          ticketPubkey
        );
        setDeepLinkEventPubkey(ticketAcc.event as PublicKey);
      } catch (e) {
        console.error("[checkin] Failed to fetch ticket account for deep link", e);
        setTxStatus("❌ Invalid or unknown ticket in check-in link");
        setDeepLinkEventPubkey(null);
      }
    })();
  }, [program, deepLinkTicket]);

  useEffect(() => {
    if (!deepLinkEventPubkey || events.length === 0) return;

    const match = events.find((ev) => ev.pubkey.equals(deepLinkEventPubkey));
    if (match) {
      setSelectedEvent(match);
      setMainTab("explore");
    } else {
      console.warn(
        "[checkin] Deep-linked ticket's event not found in loaded events",
        deepLinkEventPubkey.toBase58()
      );
    }
  }, [deepLinkEventPubkey, events]);


  const handleCreateEvent = async (params: {
    priceSol: string;
    title: string;
    description: string;
  }) => {
    if (!program || !wallet.publicKey) return;

    try {
      setTxStatus("⏳ Creating event on devnet…");

      const eventIdBn = generateEventIdBn();

      const normalized = (params.priceSol || "0").replace(",", ".");
      const priceSolNum = parseFloat(normalized);
      if (Number.isNaN(priceSolNum) || priceSolNum < 0) {
        throw new Error("Invalid ticket price");
      }

      const priceLamports = Math.round(priceSolNum * LAMPORTS_PER_SOL);
      const priceLamportsBn = new BN(priceLamports.toString());

      const eventPda = deriveEventPdaFromSigner(wallet.publicKey, eventIdBn);

      const sig = await program.methods
        .initEvent(
          eventIdBn,
          priceLamportsBn,
          params.title,
          params.description
        )
        .accounts({
          signer: wallet.publicKey,
          event: eventPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxStatus(`✅ Event created. tx: ${sig}`);
      await refreshEvents();
    } catch (e) {
      handleError(e);
    }
  };

  const handleJoinEvent = async (params: { eventPubkey: string }) => {
    if (!program || !wallet.publicKey) return;

    if (!params.eventPubkey) {
      setTxStatus("❌ Select an event to join");
      return;
    }

    try {
      setTxStatus("⏳ Preparing mint + joining event…");

      const eventPubkey = new PublicKey(params.eventPubkey);
      const eventData = events.find((e) => e.pubkey.equals(eventPubkey));
      if (!eventData) {
        setTxStatus("❌ Selected event not found in local list");
        return;
      }

      const user = wallet.publicKey;
      const eventPda = eventPubkey;

      const mintKeypair = Keypair.generate();
      const mint = mintKeypair.publicKey;

      const [mintAuthPda] = PublicKey.findProgramAddressSync(
        [utf8("mint_auth"), mint.toBytes()],
        PROGRAM_ID
      );

      const lamportsForMint =
        await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

      const createMintIx = SystemProgram.createAccount({
        fromPubkey: user,
        newAccountPubkey: mint,
        lamports: lamportsForMint,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      });

      const initMintIx = createInitializeMintInstruction(
        mint,
        0,
        mintAuthPda,
        null
      );

      const buyerAta = await getAssociatedTokenAddress(mint, user);
      const createAtaIx = createAssociatedTokenAccountInstruction(
        user,
        buyerAta,
        user,
        mint
      );

      const setupTx = new Transaction().add(
        createMintIx,
        initMintIx,
        createAtaIx
      );

      const setupSig = await wallet.sendTransaction(setupTx, connection, {
        signers: [mintKeypair],
      });
      console.log("Mint + ATA setup tx:", setupSig);

      setTxStatus("⏳ Calling join_event… This will also pay the ticket price.");

      const [ticketPda] = PublicKey.findProgramAddressSync(
        [utf8("ticket"), eventPda.toBytes(), user.toBytes()],
        PROGRAM_ID
      );

      const sig = await program.methods
        .joinEvent()
        .accounts({
          signer: user,
          event: eventPda,
          ticket: ticketPda,
          mint,
          mintAuthority: mintAuthPda,
          buyerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxStatus(`✅ Joined event & minted ticket. tx: ${sig}`);
      await refreshTickets();
    } catch (e) {
      handleError(e);
    }
  };

  const handleWithdraw = async (params: {
    eventPubkey: string;
    amountSol: string;
  }) => {
    if (!program || !wallet.publicKey) return;
    if (!params.eventPubkey) {
      setTxStatus("❌ Select an event to withdraw from");
      return;
    }

    try {
      setTxStatus("⏳ Sending withdraw…");

      const eventPubkey = new PublicKey(params.eventPubkey);
      const amountSolNum = parseFloat(params.amountSol || "0");
      const amountLamports = Math.floor(amountSolNum * LAMPORTS_PER_SOL);
      const amountBn = new BN(amountLamports.toString());

      const sig = await program.methods
        .withdraw(amountBn)
        .accounts({
          signer: wallet.publicKey,
          event: eventPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxStatus(`✅ withdraw tx: ${sig}`);
    } catch (e) {
      handleError(e);
    }
  };

  const handleCheckIn = async (ticket: TicketAccount, event: EventAccount) => {
    if (!program || !wallet.publicKey) return;

    try {
      if (!event.organizer.equals(wallet.publicKey)) {
        setTxStatus("❌ Only the event organizer can check in attendees");
        return;
      }

      setTxStatus("⏳ Sending check_in…");

      const eventPda = event.pubkey;

      const sig = await program.methods
        .checkIn()
        .accounts({
          signer: wallet.publicKey,
          event: eventPda,
          ticket: ticket.pubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxStatus(`✅ check_in tx: ${sig}`);
      await refreshTickets();
    } catch (e) {
      handleError(e);
    }
  };

  const handleOrganizerCheckInByAddress = async (
    ticketAddress: string,
    event: EventAccount
  ) => {
    if (!program || !wallet.publicKey) return;

    try {
      const extracted = extractTicketAddressFromInput(ticketAddress);

      if (!extracted) {
        setTxStatus("❌ Could not find a ticket address in the scanned data");
        return;
      }

      if (!event.organizer.equals(wallet.publicKey)) {
        setTxStatus("❌ Only the event organizer can check in attendees");
        return;
      }

      let ticketPubkey: PublicKey;
      try {
        ticketPubkey = new PublicKey(extracted);
      } catch {
        setTxStatus("❌ Invalid ticket public key");
        return;
      }

      let ticketAcc: any;
      try {
        ticketAcc = await (program.account as any).ticket.fetch(ticketPubkey);
      } catch (fetchErr) {
        console.error("[checkin] Ticket fetch error", fetchErr);
        setTxStatus("❌ That account is not a Ticket account for this program");
        return;
      }

      if (!ticketAcc.event.equals(event.pubkey)) {
        console.warn(
          "[checkin] Ticket belongs to different event",
          ticketAcc.event.toBase58(),
          "vs",
          event.pubkey.toBase58()
        );
        setTxStatus("❌ This ticket belongs to a different event");
        return;
      }

      if (ticketAcc.checkedIn) {
        setTxStatus("ℹ️ This ticket is already checked in");
        return;
      }

      setTxStatus("⏳ Checking in attendee…");

      const eventPda = event.pubkey;

      const sig = await program.methods
        .checkIn()
        .accounts({
          signer: wallet.publicKey,
          event: eventPda,
          ticket: ticketPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxStatus(`✅ Attendee checked in. tx: ${sig}`);
      await refreshTickets();
    } catch (e) {
      handleError(e);
    }
  };

  const renderMainContent = () => {
    if (mainTab === "explore") {
      return (
        <div className="app-layout__two-column">
          <div className="app-layout__column app-layout__column--primary">
            <EventsPanel
              events={events}
              tickets={tickets}
              loading={eventsLoading}
              error={eventsError}
              onRefresh={refreshEvents}
              currentWallet={wallet.publicKey ?? null}
              onSelectEvent={setSelectedEvent}
              selectedEvent={selectedEvent}
              onBuyTicket={(eventPubkey) => handleJoinEvent({ eventPubkey })}
            />
            {selectedEvent && (
              <EventDetailsPanel
                event={selectedEvent}
                currentWallet={wallet.publicKey ?? null}
                tickets={tickets}
                onClose={() => setSelectedEvent(null)}
                onOrganizerCheckIn={handleOrganizerCheckInByAddress}
                deepLinkTicket={
                  deepLinkTicket &&
                  deepLinkEventPubkey &&
                  selectedEvent.pubkey.equals(deepLinkEventPubkey)
                    ? deepLinkTicket
                    : null
                }
              />
            )}
          </div>

          <div className="app-layout__column app-layout__column--secondary">
            <TicketsPanel
              tickets={tickets}
              loading={ticketsLoading}
              error={ticketsError}
              onRefresh={refreshTickets}
              connected={connected}
              events={events}
              onCheckIn={handleCheckIn}
              currentWallet={wallet.publicKey ?? null}
            />
          </div>
        </div>
      );
    }

    if (mainTab === "tickets") {
      return (
        <div className="app-layout__single-card">
          <TicketsPanel
            tickets={tickets}
            loading={ticketsLoading}
            error={ticketsError}
            onRefresh={refreshTickets}
            connected={connected}
            events={events}
            onCheckIn={handleCheckIn}
            currentWallet={wallet.publicKey ?? null}
          />
        </div>
      );
    }

    return (
      <div className="app-layout__manage">
        <div className="app-layout__tabs app-layout__tabs--sub">
          <button
            className={`app-layout__tab ${
              manageTab === "create" ? "app-layout__tab--active" : ""
            }`}
            onClick={() => setManageTab("create")}
          >
            Create event
          </button>
          <button
            className={`app-layout__tab ${
              manageTab === "join" ? "app-layout__tab--active" : ""
            }`}
            onClick={() => setManageTab("join")}
          >
            Join event
          </button>
          <button
            className={`app-layout__tab ${
              manageTab === "withdraw" ? "app-layout__tab--active" : ""
            }`}
            onClick={() => setManageTab("withdraw")}
          >
            Withdraw
          </button>
        </div>

        <div className="app-layout__manage-body">
          {manageTab === "create" && (
            <CreateEventCard
              disabled={!connected}
              onSubmit={handleCreateEvent}
            />
          )}
          {manageTab === "join" && (
            <JoinEventCard
              disabled={!connected}
              events={events}
              onSubmit={handleJoinEvent}
            />
          )}
          {manageTab === "withdraw" && (
            <WithdrawCard
              disabled={!connected}
              events={events}
              currentWallet={wallet.publicKey ?? null}
              onSubmit={handleWithdraw}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app-layout">
      <HeaderBar programId={PROGRAM_ID.toBase58()} />
      <StatusBanner message={txStatus} />

      <div className="app-layout__shell">
        <div className="app-layout__tabs">
          <button
            className={`app-layout__tab ${
              mainTab === "explore" ? "app-layout__tab--active" : ""
            }`}
            onClick={() => setMainTab("explore")}
          >
            Explore
          </button>
          <button
            className={`app-layout__tab ${
              mainTab === "tickets" ? "app-layout__tab--active" : ""
            }`}
            onClick={() => setMainTab("tickets")}
          >
            My Tickets
          </button>
          <button
            className={`app-layout__tab ${
              mainTab === "manage" ? "app-layout__tab--active" : ""
            }`}
            onClick={() => setMainTab("manage")}
          >
            Manage
          </button>
        </div>

        <div className="app-layout__content">{renderMainContent()}</div>
      </div>
    </div>
  );
};

export default AppLayout;