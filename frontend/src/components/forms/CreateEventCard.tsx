import React, { useState } from "react";
import "./CreateEventCard.scss";

type Props = {
  disabled: boolean;
  onSubmit: (params: {
    priceSol: string;
    title: string;
    description: string;
  }) => void;
};

const CreateEventCard: React.FC<Props> = ({ disabled, onSubmit }) => {
  const [priceSol, setPriceSol] = useState("0.1");
  const [title, setTitle] = useState("My Event");
  const [description, setDescription] = useState("Description…");

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    if (value === "") {
      setPriceSol("");
      return;
    }

    value = value.replace(",", ".");

    const num = Number(value);
    if (Number.isNaN(num) || num < 0) {
      return;
    }

    setPriceSol(value);
  };

  const handleClick = () => {
    const cleanPrice = priceSol === "" ? "0" : priceSol;
    onSubmit({ priceSol: cleanPrice, title, description });
  };

  return (
    <section
      className={`create-event-card ${
        disabled ? "create-event-card--disabled" : ""
      }`}
    >
      <h2 className="create-event-card__title">Create Event</h2>
      {disabled && (
        <p className="create-event-card__hint">
          Connect your wallet to create a new event on devnet.
        </p>
      )}
      <p className="create-event-card__hint-small">
        Event ID is generated automatically from the current timestamp and stored
        on-chain as a <code>u64</code>.
      </p>
      <div className="create-event-card__form">
        <label className="create-event-card__label">
          Ticket price (SOL)
          <input
            type="number"
            min="0"
            step="0.000000001"
            value={priceSol}
            onChange={handlePriceChange}
            className="create-event-card__input"
          />
          <span className="create-event-card__help">
            This is the price per ticket in SOL. The frontend converts it to{" "}
            <code>lamports</code> (1 SOL = 1,000,000,000 lamports) before
            sending it to the program.
          </span>
        </label>
        <label className="create-event-card__label">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="create-event-card__input"
          />
        </label>
        <label className="create-event-card__label">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="create-event-card__input create-event-card__textarea"
          />
        </label>
        <button
          disabled={disabled}
          onClick={handleClick}
          className="create-event-card__button"
        >
          Create event on devnet
        </button>
      </div>
    </section>
  );
};

export default CreateEventCard;