import React, { useEffect, useMemo, useState } from "react";
import "./EventDetailsPanel.scss";
import type { EventAccount, TicketAccount } from "../../solana/types";
import type { PublicKey } from "@solana/web3.js";
import { LAMPORTS_PER_SOL, connection } from "../../solana/config";

type Props = {
  event: EventAccount;
  currentWallet: PublicKey | null;
  tickets: TicketAccount[];
  onClose: () => void;
  onOrganizerCheckIn: (ticketPubkey: string, event: EventAccount) => void;
  deepLinkTicket?: string | null;
};

const solscanAccountUrl = (pubkey: string) =>
  `https://solscan.io/account/${pubkey}?cluster=devnet`;

const EventDetailsPanel: React.FC<Props> = ({
  event,
  currentWallet,
  tickets,
  onClose,
  onOrganizerCheckIn,
  deepLinkTicket,
}) => {
  const [ticketAddress, setTicketAddress] = useState("");
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);

  const priceSol = Number(event.price.toString()) / LAMPORTS_PER_SOL;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const info = await connection.getAccountInfo(event.pubkey);
        if (!cancelled) {
          setBalanceLamports(info ? info.lamports : null);
        }
      } catch (err) {
        console.error("Failed to fetch event balance", err);
        if (!cancelled) setBalanceLamports(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [event.pubkey.toBase58()]);

  useEffect(() => {
    if (deepLinkTicket) {
      setTicketAddress(deepLinkTicket);
    }
  }, [deepLinkTicket]);

  const balanceSol =
    balanceLamports !== null ? balanceLamports / LAMPORTS_PER_SOL : null;

  const roleLabel = useMemo(() => {
    if (!currentWallet) return null;

    if (event.organizer.equals(currentWallet)) {
      return "Organizer";
    }

    const hasTicket = tickets.some(
      (t) => t.event.equals(event.pubkey) && t.owner.equals(currentWallet)
    );

    if (hasTicket) {
      return "Attendee";
    }

    return null;
  }, [currentWallet, event, tickets]);

  const myTicket = useMemo(() => {
    if (!currentWallet) return null;
    return tickets.find(
      (t) => t.event.equals(event.pubkey) && t.owner.equals(currentWallet)
    );
  }, [currentWallet, event, tickets]);

  const handleOrganizerCheckInClick = () => {
    onOrganizerCheckIn(ticketAddress, event);
  };

  const organizerStr = event.organizer.toBase58();
  const pdaStr = event.pubkey.toBase58();

  return (
    <aside className="event-details">
      <div className="event-details__header">
        <div>
          <h3 className="event-details__title">
            {event.title || "Untitled event"}
          </h3>
          <span className="event-details__id">
            #{event.event_id.toString()}
          </span>
        </div>
        <button
          className="event-details__close"
          onClick={onClose}
          aria-label="Close event details"
        >
          ✕
        </button>
      </div>

      <p className="event-details__price">
        <strong>{priceSol.toFixed(4)} SOL</strong> per ticket
      </p>

      {event.description && (
        <p className="event-details__description">{event.description}</p>
      )}

      <div className="event-details__meta">
        <div>
          <span className="event-details__label">Organizer</span>
          <a
            href={solscanAccountUrl(organizerStr)}
            target="_blank"
            rel="noreferrer"
            className="event-details__value event-details__link"
          >
            {organizerStr}
          </a>
        </div>
        <div>
          <span className="event-details__label">Event PDA</span>
          <a
            href={solscanAccountUrl(pdaStr)}
            target="_blank"
            rel="noreferrer"
            className="event-details__value event-details__link"
          >
            {pdaStr}
          </a>
        </div>

        {balanceSol !== null && (
          <div>
            <span className="event-details__label">Event balance</span>
            <span className="event-details__value">
              {balanceSol.toFixed(4)} SOL
              <span className="event-details__sub">
                {" "}
                ({balanceLamports} lamports)
              </span>
            </span>
          </div>
        )}
      </div>

      {roleLabel && (
        <div className="event-details__role">
          <span>Your role: </span>
          <strong>{roleLabel}</strong>
        </div>
      )}

      {roleLabel === "Attendee" && myTicket && (
        <div className="event-details__ticket">
          <h4 className="event-details__section-title">My Ticket</h4>
          <div className="event-details__ticket-row">
            <span className="event-details__label">Ticket account</span>
            <a
              href={solscanAccountUrl(myTicket.pubkey.toBase58())}
              target="_blank"
              rel="noreferrer"
              className="event-details__value event-details__link"
            >
              {myTicket.pubkey.toBase58()}
            </a>
          </div>
          <div className="event-details__ticket-row">
            <span className="event-details__label">Mint</span>
            <a
              href={solscanAccountUrl(myTicket.mint.toBase58())}
              target="_blank"
              rel="noreferrer"
              className="event-details__value event-details__link"
            >
              {myTicket.mint.toBase58()}
            </a>
          </div>
          <div className="event-details__ticket-row">
            <span className="event-details__label">Status</span>
            <span className="event-details__value">
              {myTicket.checked_in ? "✅ Checked in" : "❌ Not checked in"}
            </span>
          </div>
          <p className="event-details__hint">
            Only the organizer can check you in at the venue.
          </p>
        </div>
      )}

      {roleLabel === "Organizer" && (
        <div className="event-details__organizer-tools">
          <h4 className="event-details__section-title">Organizer Tools</h4>
          <p className="event-details__hint">
            Paste the <strong>Ticket account address</strong> from the attendee’s
            ticket (the one labeled <em>"Ticket account"</em> in their ticket view),
            or open this page via a QR check-in link. Then press{" "}
            <strong>Check in attendee</strong>.
          </p>

          <label className="event-details__label-block">
            Ticket account address
            <input
              type="text"
              className="event-details__input"
              placeholder="e.g. 9XcwuJrTfpa122RM59QQqj7ucobZxhLtKCyKYyNCpQ2s"
              value={ticketAddress}
              onChange={(e) => setTicketAddress(e.target.value)}
            />
          </label>

          <button
            className="event-details__button"
            onClick={handleOrganizerCheckInClick}
          >
            Check in attendee
          </button>
        </div>
      )}
    </aside>
  );
};

export default EventDetailsPanel;