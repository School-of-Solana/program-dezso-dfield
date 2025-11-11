import React, { useState, useMemo } from "react";
import "./JoinEventCard.scss";
import type { EventAccount } from "../../solana/types";
import { LAMPORTS_PER_SOL } from "../../solana/config";

type Props = {
  disabled: boolean;
  events: EventAccount[];
  onSubmit: (params: { eventPubkey: string }) => void;
};

const JoinEventCard: React.FC<Props> = ({
  disabled,
  events,
  onSubmit,
}) => {
  const [selectedEvent, setSelectedEvent] = useState("");

  const selected = useMemo(
    () => events.find((e) => e.pubkey.toBase58() === selectedEvent),
    [events, selectedEvent]
  );

  const priceSol = selected
    ? Number(selected.price.toString()) / LAMPORTS_PER_SOL
    : 0;

  const handleClick = () => {
    if (!selected) {
      alert("Please select an event first.");
      return;
    }

    const confirmed = window.confirm(
      `You are about to join "${selected.title}" and pay ${priceSol.toFixed(
        4
      )} SOL to the event's escrow account, plus a small network fee.\n\nContinue?`
    );

    if (!confirmed) return;

    onSubmit({ eventPubkey: selectedEvent });
  };

  return (
    <section
      className={`join-event-card ${
        disabled ? "join-event-card--disabled" : ""
      }`}
    >
      <h2 className="join-event-card__title">Join Event</h2>
      {disabled && (
        <p className="join-event-card__hint">
          Connect your wallet to pay the event price and mint a ticket NFT.
        </p>
      )}
      <p className="join-event-card__hint-small">
        When you join:
        <br />
        1) A new mint is created with <code>mint_auth</code> PDA as authority
        <br />
        2) Your ATA is created for that mint
        <br />
        3) The program mints <strong>1 ticket NFT</strong> to you and
           transfers the event price in SOL to the event escrow account
      </p>
      <div className="join-event-card__form">
        <label className="join-event-card__label">
          Event
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="join-event-card__input"
            disabled={disabled}
          >
            <option value="">Select an event</option>
            {events.map((ev) => (
              <option
                key={ev.pubkey.toBase58()}
                value={ev.pubkey.toBase58()}
              >
                {ev.title} (#{ev.event_id.toString()})
              </option>
            ))}
          </select>
          {selected && (
            <span className="join-event-card__help">
              You will pay{" "}
              <strong>{priceSol.toFixed(4)} SOL</strong>{" "}
              to the event escrow account when you confirm the join transaction,
              plus network fees. Organizer:{" "}
              {selected.organizer.toBase58().slice(0, 8)}…
            </span>
          )}
        </label>

        {selected && (
          <div className="join-event-card__warning">
            <strong>Note:</strong> Phantom&apos;s second popup may only show the
            network fee, but the full{" "}
            <strong>{priceSol.toFixed(4)} SOL</strong> will still be transferred
            to the event&apos;s escrow account by the program.
          </div>
        )}

        <button
          disabled={disabled || !selected}
          onClick={handleClick}
          className="join-event-card__button"
        >
          Join event &amp; mint ticket
        </button>
      </div>
    </section>
  );
};

export default JoinEventCard;