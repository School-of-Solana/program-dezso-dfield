# Solana Event dApp – Project Description

**Deployed Frontend URL:** https://event.dfieldsolutions.com  
**Solana Program ID:** `EASxLwbjSfJn75XGj1aHtA17jSc7xCSkuAcMnwJbSUBC`

---

## 🎥 Project Demo

<video width="100%" controls>
    <source src="video_small.mp4" type="video/mp4">
    Your browser does not support the video tag. Please view the demo video: <a href="video.mp4">video.mp4</a>
</video>

---

## Project Overview

### Description

This project is a **Solana-based event ticketing dApp** running on **devnet**.  
Organizers can create on-chain events, attendees can join events and receive **NFT-style SPL tickets**, and organizers can **check in** attendees and **withdraw funds** collected from ticket sales.

The core flow is:

- Organizer creates an event on-chain with a unique event ID, title, description, and ticket price.
- Users browse available events in the frontend.
- A user joins an event:
  - The frontend creates an SPL mint and the user's associated token account (ATA).
  - The program mints **1 ticket token** to the user's ATA via a PDA mint authority.
  - The event account receives SOL equal to the event price.
- On event day, the attendee can be checked in via the dApp, which marks their ticket as used.
- The organizer can withdraw accumulated funds from the event account back to their wallet.

Everything is built around **Anchor** and uses **PDAs** to safely and deterministically derive accounts.

### Key Features

- **Event Creation (Organizer)**  
  Create new events on devnet with:
  - Auto-generated `event_id` (based on timestamp)
  - Human-readable title & description
  - Price specified in SOL (stored in lamports on-chain)

- **Ticket NFTs on Join**  
  When a user joins an event:
  - A dedicated SPL mint is created for the ticket
  - A PDA acts as the mint authority
  - 1 token is minted to the user's associated token account
  - An on-chain `Ticket` account is created and linked to the user & event

- **Check-In Flow**  
  The contract allows marking a ticket as **checked in**. This can be used at the door of an event to verify attendance.

- **Funds Management & Withdraw**  
  The SOL paid when joining an event is accumulated on the `Event` account.  
  The organizer (and only the organizer) can withdraw available funds from the event, while preserving rent-exempt balance.

- **Modern Frontend**  
  - React + TypeScript
  - Wallet Adapter with Phantom/Solflare
  - Modern, tab-based UI:
    - **Explore**: Events list & my tickets
    - **Organizer**: Create event & withdraw
    - **Activity**: (Room for future analytics / logs)

### How to Use the dApp

1. **Open the dApp on Devnet**  
   - Make sure your wallet (e.g. Phantom) is set to **Devnet**.
   - Optional: Use a Solana devnet faucet to airdrop SOL into your wallet.

2. **Connect Wallet**  
   - Click the **"Select Wallet" / "Connect"** button in the top-right.
   - Approve the connection in your wallet.

3. **Create an Event (Organizer)**  
   - Go to the **Organizer** tab.
   - Fill in:
     - Ticket price in SOL (e.g. `0.5`)
     - Event title
     - Description
   - Click **"Create event on devnet"**.
   - Approve the transaction in your wallet.
   - The new event will appear in the **Events** list once confirmed.

4. **Join an Event (Attendee)**  
   - Go to the **Explore** tab and view the list of events.
   - Click **"Join event"** for the event you want to attend (via the Join panel).
   - The frontend will:
     - Create a new SPL mint for your ticket
     - Create your ATA for that mint
     - Call the program to:
       - Transfer the ticket price in SOL to the event account
       - Mint 1 ticket token to your ATA
       - Create and initialize your `Ticket` account
   - After confirmation, your ticket will appear in **My Tickets**.

5. **Check-In (At the Event)**  
   - In the **Explore → My Tickets** section, the organizer (or a door agent with proper UI) can call **Check In** for a ticket.
   - The program marks `checked_in = true` on the `Ticket` account.

6. **Withdraw Event Funds (Organizer)**  
   - Go to the **Organizer → Withdraw** panel.
   - Select one of your events.
   - Specify the amount in SOL to withdraw:
     - `0` or a value greater than the available amount will withdraw **all available funds** (after rent).
   - Click **"Withdraw"** and approve in your wallet.
   - Funds are transferred from the `Event` account back to your organizer wallet.

---

## Program Architecture

The program is built using **Anchor** and is organized around a few core instructions and account types.

### High-Level Flow

- `init_event` creates an `Event` account and initializes its metadata.
- `join_event`:
  - Optionally transfers SOL from the attendee to the event account.
  - Uses a **PDA mint authority** to mint 1 token into the attendee’s ATA.
  - Creates a `Ticket` account linked to that event & owner.
- `check_in` marks a ticket as used once the attendee arrives.
- `withdraw` allows the organizer to pull funds out of the event account, leaving rent intact.
- `init_ticket` is a more basic initializer for tickets (used or kept for flexibility / testing).

### PDA Usage

PDAs are heavily used for safety and deterministic account derivation.

**PDAs Used:**

- **Event PDA**
  - **Seeds:** `["event", organizer_pubkey, event_id.to_le_bytes()]`
  - **Account:** `Event`
  - **Purpose:** Stores a single event’s metadata and collected funds.
  - **Why:** Ensures a unique, deterministic address for each organizer/event_id pair and prevents arbitrary event accounts from being forged.

- **Ticket PDA**
  - **Seeds:** `["ticket", event_pubkey, owner_pubkey]`
  - **Account:** `Ticket`
  - **Purpose:** Represents a user’s ticket for a specific event.
  - **Why:** Ties tickets uniquely to `(event, owner)`, so each user has a consistent ticket PDA for a given event.

- **Mint Authority PDA**
  - **Seeds:** `["mint_auth", mint_pubkey]`
  - **Account:** Unchecked account (PDA used only as signer)
  - **Purpose:** Serves as the mint authority for the SPL token used as the ticket.
  - **Why:** The mint’s authority must be a program-owned PDA to allow the program to call `token::mint_to` with `CpiContext::new_with_signer`.

### Program Instructions

**Instructions Implemented:**

- `init_event(ctx, event_id: u64, price_sol: u64, title: String, description: String)`  
  - Derives and initializes the `Event` PDA.  
  - Stores price (in lamports), title, description, and organizer.  
  - Emits a `CreateEvent` event.

- `init_ticket(ctx)`  
  - Initializes a `Ticket` account without minting a token (more generic initializer).  
  - Sets `owner`, `event`, `mint` (default), and `checked_in = false`.  
  - Emits a `CreateTicket` event.

- `join_event(ctx)`  
  - For a given event:
    - Transfers `event.price` lamports from `signer` to the `event` account if `price > 0`.
    - Mints **1 SPL token** to `buyer_ata` using the PDA `[b"mint_auth", mint.key().as_ref()]` as authority.
    - Initializes the `Ticket` PDA:
      - `ticket.event = event.key()`
      - `ticket.owner = signer.key()`
      - `ticket.mint = mint.key()`
      - `ticket.checked_in = false`
  - Emits a `JoinedEvent` event.

- `check_in(ctx)`  
  - Verifies:
    - The ticket belongs to the given event.
    - The signer is the ticket owner.
    - The ticket is not already checked in.
  - Sets `ticket.checked_in = true`.  
  - Emits `CheckedIn` event with the current timestamp.

- `withdraw(ctx, amount: u64)`  
  - Ensures the signer is the event’s organizer.
  - Computes rent-exempt minimum for the event account and available lamports above rent.
  - Determines how much to send (`amount` or all available, if `amount == 0` or too large).
  - Transfers lamports from the event account to the organizer.

### Account Structure

#### `Event`

```rust
#[account]
pub struct Event {
    pub price: u64,         // ticket price in lamports
    pub title: String,      // event title
    pub description: String,// event description
    pub event_id: u64,      // unique ID (generated client-side)
    pub organizer: Pubkey,  // organizer wallet
    pub bump: u8,           // PDA bump
}
```

#### `Ticket`

```rust
#[account]
pub struct Ticket {
    pub event: Pubkey,      // associated event
    pub owner: Pubkey,      // wallet that owns the ticket
    pub mint: Pubkey,       // SPL token mint used as NFT
    pub checked_in: bool,   // has attendee been checked in?
    pub bump: u8,           // PDA bump
}
```

---

## Testing

### Test Coverage

The ideal test suite (or target coverage) for this project includes:

**Happy Path Tests:**

- **Create Event**
  - Organizer calls `init_event` with valid parameters.
  - Event account is created with correct seeds and data.
- **Join Event & Mint Ticket**
  - User joins an event that exists and has a positive price.
  - Lamports are transferred from user to event account.
  - Ticket PDA is created and initialized correctly.
  - 1 token is minted to the user’s ATA by the mint authority PDA.
- **Check-In**
  - Ticket owner calls `check_in` for their own ticket.
  - `checked_in` flips from `false` to `true`.
- **Withdraw**
  - Organizer calls `withdraw` with various `amount` values (0, partial, full).
  - Balance on event account decreases and signer’s balance increases accordingly.

**Unhappy Path Tests:**

- **Unauthorized Withdraw**
  - Non-organizer tries to call `withdraw` and fails with `EventError::Unauthorized`.
- **Double Check-In**
  - Attempt to check in a ticket that is already checked in; should fail with `EventError::AlreadyCheckedIn`.
- **Wrong Event for Ticket**
  - Attempt to check in a ticket with a mismatched event; should fail with `EventError::WrongEvent`.
- **No Funds to Withdraw**
  - Organizer tries to withdraw when no available funds are in the event account; should fail with `EventError::NoFunds`.

### Running Tests

```bash
# Build the program
anchor build

# Run Anchor tests (once you have tests defined in the /tests directory)
anchor test
```

---

## Additional Notes for Evaluators

- The dApp is built around **Anchor** best practices:
  - Typed accounts
  - PDAs for all critical state
  - Events emitted for key actions (create, join, ticket, check-in, withdraw).
- The frontend:
  - Uses **wallet-adapter** for Phantom/Solflare support.
  - Implements a **tabbed UI** to separate browsing, attending, and organizing flows.
  - Handles mint & ATA setup client-side before calling `join_event`, so the on-chain program focuses on security & state transitions.
- The project is intended as a foundation:
  - You could easily add features like:
    - Max ticket supply
    - Event time & location
    - On-chain metadata or integration with Metaplex
    - QR-code based check-in flows.
