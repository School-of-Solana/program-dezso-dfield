// src/components/panels/TicketsPanel.tsx

import React, { useState, useMemo } from "react";
import "./TicketsPanel.scss";
import type { TicketAccount, EventAccount } from "../../solana/types";
import type { PublicKey } from "@solana/web3.js";
import { QRCodeCanvas } from "qrcode.react";

type Props = {
  tickets: TicketAccount[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  connected: boolean;
  events: EventAccount[];
  currentWallet: PublicKey | null;
  onCheckIn: (ticket: TicketAccount, event: EventAccount) => void;
};

const solscanAccountUrl = (pubkey: string) =>
  `https://solscan.io/account/${pubkey}?cluster=devnet`;

const rawBaseUrl = "https://event.dfieldsolutions.com";

let checkinBaseUrl: string | null = null;
try {
  if (rawBaseUrl) {
    const u = new URL(rawBaseUrl);
    checkinBaseUrl = u.origin;
  } else {
    console.error(
      "[TicketsPanel] VITE_CHECKIN_BASE_URL is not set. QR check-in URLs are disabled."
    );
  }
} catch (e) {
  console.error(
    "[TicketsPanel] Invalid VITE_CHECKIN_BASE_URL, expected a valid URL. QR check-in URLs are disabled.",
    e
  );
  checkinBaseUrl = null;
}

const TicketsPanel: React.FC<Props> = ({
  tickets,
  loading,
  error,
  onRefresh,
  connected,
  events,
  currentWallet,
  onCheckIn,
}) => {
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [qrTicket, setQrTicket] = useState<string | null>(null);
  const [copiedTicket, setCopiedTicket] = useState<string | null>(null);

  const qrEnabled = !!checkinBaseUrl;

  const handleCopyTicket = async (ticketAddr: string) => {
    try {
      await navigator.clipboard.writeText(ticketAddr);
      setCopiedTicket(ticketAddr);
      setTimeout(() => {
        setCopiedTicket((prev) => (prev === ticketAddr ? null : prev));
      }, 1500);
    } catch (e) {
      console.error("Failed to copy ticket address", e);
    }
  };

  const qrWarning = useMemo(() => {
    if (!qrEnabled && connected && tickets.length > 0) {
      return (
        <p className="tickets-panel__warning">
          QR check-in links are disabled because <code>VITE_CHECKIN_BASE_URL</code>{" "}
          is not configured or invalid.
        </p>
      );
    }
    return null;
  }, [qrEnabled, connected, tickets.length]);

  return (
    <section className="tickets-panel">
      <div className="tickets-panel__header">
        <div>
          <h2 className="tickets-panel__title">My Tickets</h2>
          <p className="tickets-panel__subtitle">
            Your on-chain tickets for events you’ve joined.
          </p>
        </div>
        {connected && (
          <button className="tickets-panel__refresh" onClick={onRefresh}>
            Refresh
          </button>
        )}
      </div>

      {qrWarning}

      {!connected && (
        <p className="tickets-panel__info">
          Connect your wallet to see tickets you’ve minted by joining events.
        </p>
      )}
      {loading && <p className="tickets-panel__info">Loading tickets…</p>}
      {error && <p className="tickets-panel__error">{error}</p>}

      <div className="tickets-panel__list">
        {tickets.map((t) => {
          const event = events.find((e) => e.pubkey.equals(t.event));

          const isOrganizer =
            !!event &&
            !!currentWallet &&
            event.organizer.equals(currentWallet);

          const canCheckIn = connected && event && isOrganizer && !t.checked_in;

          const ticketStr = t.pubkey.toBase58();
          const eventStr = t.event.toBase58();
          const ownerStr = t.owner.toBase58();
          const mintStr = t.mint.toBase58();

          const isExpanded = expandedTicket === ticketStr;
          const showQr = qrTicket === ticketStr;

          const checkinUrl =
            qrEnabled && checkinBaseUrl
              ? `${checkinBaseUrl}/checkin?ticket=${encodeURIComponent(
                  ticketStr
                )}`
              : null;

          return (
            <div key={ticketStr} className="tickets-panel__item ticket-card">
              <div className="ticket-card__header">
                <div className="ticket-card__header-main">
                  <h3 className="ticket-card__title">
                    {event?.title || "Event ticket"}
                  </h3>
                  {event && (
                    <span className="ticket-card__event-id">
                      #{event.event_id.toString()}
                    </span>
                  )}
                </div>
                <span
                  className={`ticket-card__status ${
                    t.checked_in
                      ? "ticket-card__status--checked"
                      : "ticket-card__status--pending"
                  }`}
                >
                  {t.checked_in ? "Checked in" : "Not checked in"}
                </span>
              </div>

              <div className="ticket-card__primary">
                <div className="ticket-card__row">
                  <span className="ticket-card__label">Ticket account</span>
                  <div className="ticket-card__value-wrap">
                    <a
                      href={solscanAccountUrl(ticketStr)}
                      target="_blank"
                      rel="noreferrer"
                      className="ticket-card__value ticket-card__link ticket-card__value--mono"
                    >
                      {ticketStr}
                    </a>
                    <button
                      className="ticket-card__chip"
                      onClick={() => handleCopyTicket(ticketStr)}
                    >
                      {copiedTicket === ticketStr ? "Copied" : "Copy"}
                    </button>
                    <button
                      className="ticket-card__chip"
                      disabled={!checkinUrl}
                      title={
                        checkinUrl
                          ? "Show QR code pointing to the on-site check-in URL"
                          : "QR disabled: check-in base URL not configured"
                      }
                      onClick={() =>
                        checkinUrl &&
                        setQrTicket((current) =>
                          current === ticketStr ? null : ticketStr
                        )
                      }
                    >
                      {showQr ? "Hide QR" : "Show QR"}
                    </button>
                  </div>
                </div>

                {showQr && checkinUrl && (
                  <div className="ticket-card__qr">
                    <QRCodeCanvas value={checkinUrl} size={128} />
                    <p className="ticket-card__hint">
                      Scan to open the check-in page for this ticket:
                      <br />
                      <span className="ticket-card__hint-url">
                        {checkinUrl}
                      </span>
                    </p>
                  </div>
                )}
                {showQr && !checkinUrl && (
                  <p className="ticket-card__hint ticket-card__hint--error">
                    QR code unavailable: check-in base URL not configured. Ask
                    the organizer to fix their environment variables.
                  </p>
                )}
              </div>
              <div
                className={`ticket-card__details ${
                  isExpanded ? "ticket-card__details--open" : ""
                }`}
              >
                {isExpanded && (
                  <>
                    <div className="ticket-card__row">
                      <span className="ticket-card__label">Event PDA</span>
                      <a
                        href={solscanAccountUrl(eventStr)}
                        target="_blank"
                        rel="noreferrer"
                        className="ticket-card__value ticket-card__link ticket-card__value--mono"
                      >
                        {eventStr}
                      </a>
                    </div>

                    {event && (
                      <div className="ticket-card__row">
                        <span className="ticket-card__label">Event title</span>
                        <span className="ticket-card__value">
                          {event.title || "Untitled event"}
                        </span>
                      </div>
                    )}

                    <div className="ticket-card__row">
                      <span className="ticket-card__label">Owner</span>
                      <a
                        href={solscanAccountUrl(ownerStr)}
                        target="_blank"
                        rel="noreferrer"
                        className="ticket-card__value ticket-card__link ticket-card__value--mono"
                      >
                        {ownerStr}
                      </a>
                    </div>

                    <div className="ticket-card__row">
                      <span className="ticket-card__label">Mint</span>
                      <a
                        href={solscanAccountUrl(mintStr)}
                        target="_blank"
                        rel="noreferrer"
                        className="ticket-card__value ticket-card__link ticket-card__value--mono"
                      >
                        {mintStr}
                      </a>
                    </div>

                    {event && (
                      <div className="ticket-card__row">
                        <span className="ticket-card__label">Organizer</span>
                        <div className="ticket-card__value-wrap">
                          <a
                            href={solscanAccountUrl(
                              event.organizer.toBase58()
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="ticket-card__value ticket-card__link ticket-card__value--mono"
                          >
                            {event.organizer.toBase58()}
                          </a>
                          {isOrganizer && (
                            <span className="ticket-card__badge">(you)</span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer actions */}
              <div className="ticket-card__footer">
                <button
                  className="ticket-card__toggle"
                  onClick={() =>
                    setExpandedTicket((current) =>
                      current === ticketStr ? null : ticketStr
                    )
                  }
                >
                  {isExpanded ? "Hide details" : "View details"}
                </button>

                {canCheckIn && event && (
                  <button
                    className="ticket-card__checkin"
                    onClick={() => onCheckIn(t, event)}
                  >
                    Check in this ticket
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {connected && !loading && tickets.length === 0 && (
          <p className="tickets-panel__info">
            You don’t hold any tickets yet. Join an event to mint a ticket NFT.
          </p>
        )}
      </div>
    </section>
  );
};

export default TicketsPanel;