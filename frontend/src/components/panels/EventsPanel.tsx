import React, { useMemo, useState } from "react";
import "./EventsPanel.scss";
import type { EventAccount, TicketAccount } from "../../solana/types";
import RoleBadge from "../shared/RoleBadge";
import type { PublicKey } from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "../../solana/config";

type Props = {
  events: EventAccount[];
  tickets: TicketAccount[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  currentWallet: PublicKey | null;

  onSelectEvent?: (event: EventAccount | null) => void;
  selectedEvent?: EventAccount | null;

  onBuyTicket?: (eventPubkey: string) => void;
};

const solscanAccountUrl = (pubkey: string) =>
  `https://solscan.io/account/${pubkey}?cluster=devnet`;

const EventsPanel: React.FC<Props> = ({
  events,
  tickets,
  loading,
  error,
  onRefresh,
  currentWallet,
  onSelectEvent,
  selectedEvent,
  onBuyTicket,
}) => {
  const [search, setSearch] = useState("");

  const handleSelect = (ev: EventAccount) => {
    if (!onSelectEvent) return;
    if (selectedEvent && selectedEvent.pubkey.equals(ev.pubkey)) {
      onSelectEvent(null);
    } else {
      onSelectEvent(ev);
    }
  };

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;

    return events.filter((ev) => {
      const title = (ev.title || "").toLowerCase();
      const addr = ev.pubkey.toBase58().toLowerCase();
      return title.includes(q) || addr.includes(q);
    });
  }, [events, search]);

  return (
    <section className="events-panel">
      <div className="events-panel__header">
        <div className="events-panel__header-left">
          <h2 className="events-panel__title">Events</h2>
          <p className="events-panel__subtitle">
            Search by title or event address.
          </p>
        </div>
        <div className="events-panel__header-right">
          <div className="events-panel__search-wrapper">
            <input
              type="text"
              className="events-panel__search"
              placeholder="Search events… (title or address)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="events-panel__refresh" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="events-panel__info">Loading events…</p>}
      {error && <p className="events-panel__error">{error}</p>}
      {!loading && events.length === 0 && (
        <p className="events-panel__info">
          No events yet. Connect and create one in the Manage tab.
        </p>
      )}
      {!loading && events.length > 0 && filteredEvents.length === 0 && (
        <p className="events-panel__info">
          No events match <code>{search}</code>.
        </p>
      )}

      <div className="events-panel__list">
        {filteredEvents.map((ev) => {
          const priceSol = Number(ev.price.toString()) / LAMPORTS_PER_SOL;
          const organizerStr = ev.organizer.toBase58();
          const pdaStr = ev.pubkey.toBase58();
          const isSelected =
            selectedEvent && selectedEvent.pubkey.equals(ev.pubkey);

          const hasTicket =
            !!currentWallet &&
            (tickets?.some(
              (t) => t.event.equals(ev.pubkey) && t.owner.equals(currentWallet)
            ) ?? false);

          return (
            <div
              key={pdaStr}
              className={`events-panel__item event-card ${
                isSelected ? "event-card--selected" : ""
              }`}
            >
              <div className="event-card__header">
                <div>
                  <h3 className="event-card__title">
                    {ev.title || "Untitled event"}
                  </h3>
                  <span className="event-card__id">
                    #{ev.event_id.toString()}
                  </span>
                </div>
                <div className="event-card__meta">
                  <span className="event-card__price">
                    {priceSol.toFixed(4)} SOL / ticket
                  </span>
                  <RoleBadge
                    wallet={currentWallet}
                    event={ev}
                    hasTicket={hasTicket}
                  />
                </div>
              </div>

              {ev.description && (
                <p className="event-card__description">{ev.description}</p>
              )}

              <div className="event-card__footer">
                <span>
                  Organizer:{" "}
                  <a
                    href={solscanAccountUrl(organizerStr)}
                    target="_blank"
                    rel="noreferrer"
                    className="event-card__link"
                  >
                    {organizerStr}
                  </a>
                </span>
                <span>
                  Event PDA:{" "}
                  <a
                    href={solscanAccountUrl(pdaStr)}
                    target="_blank"
                    rel="noreferrer"
                    className="event-card__link"
                  >
                    {pdaStr}
                  </a>
                </span>

                <div className="event-card__actions">
                  {onSelectEvent && (
                    <button
                      className="event-card__details-button"
                      onClick={() => handleSelect(ev)}
                    >
                      {isSelected ? "Hide details" : "View details"}
                    </button>
                  )}

                  {onBuyTicket && (
                    <button
                      className="event-card__buy-button"
                      onClick={() => onBuyTicket(ev.pubkey.toBase58())}
                    >
                      Buy ticket
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default EventsPanel;