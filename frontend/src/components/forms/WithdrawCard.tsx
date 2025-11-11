import React, { useState } from "react";
import "./WithdrawCard.scss";
import type { EventAccount } from "../../solana/types";
import type { PublicKey } from "@solana/web3.js";

type Props = {
  disabled: boolean;
  events: EventAccount[];
  currentWallet: PublicKey | null;
  onSubmit: (params: { eventPubkey: string; amountSol: string }) => void;
};

const WithdrawCard: React.FC<Props> = ({
  disabled,
  events,
  currentWallet,
  onSubmit,
}) => {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [amountSol, setAmountSol] = useState("0");

  const event = events.find((e) => e.pubkey.toBase58() === selectedEvent);
  const isOrganizer =
    event && currentWallet && event.organizer.equals(currentWallet);

  const handleClick = () => {
    onSubmit({ eventPubkey: selectedEvent, amountSol });
  };

  return (
    <section
      className={`withdraw-card ${
        disabled ? "withdraw-card--disabled" : ""
      }`}
    >
      <h2 className="withdraw-card__title">Withdraw (Organizer)</h2>
      {disabled && (
        <p className="withdraw-card__hint">
          Connect as the event organizer to withdraw funds from the event
          account.
        </p>
      )}
      <div className="withdraw-card__form">
        <label className="withdraw-card__label">
          Event
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="withdraw-card__input"
          >
            <option value="">Select event</option>
            {events.map((ev) => (
              <option
                key={ev.pubkey.toBase58()}
                value={ev.pubkey.toBase58()}
              >
                {ev.title} (#{ev.event_id.toString()})
              </option>
            ))}
          </select>
          {event && (
            <span className="withdraw-card__help">
              Organizer: {event.organizer.toBase58()}
              {!isOrganizer && currentWallet && (
                <> • You are not this organizer</>
              )}
            </span>
          )}
        </label>
        <label className="withdraw-card__label">
          Amount (SOL)
          <input
            type="number"
            step="0.000000001"
            value={amountSol}
            onChange={(e) => setAmountSol(e.target.value)}
            className="withdraw-card__input"
          />
          <span className="withdraw-card__help">
            0 means “withdraw all available” (respecting rent minimum).
          </span>
        </label>
        <button
          disabled={disabled}
          onClick={handleClick}
          className="withdraw-card__button"
        >
          Withdraw to my wallet
        </button>
      </div>
    </section>
  );
};

export default WithdrawCard;