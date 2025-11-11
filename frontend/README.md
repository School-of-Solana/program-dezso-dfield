# Solana Event dApp – Frontend

This is the **frontend** for the Solana Event dApp.  
It connects to a Solana program on **devnet** and lets users:

- Browse on-chain events
- Join events and receive an NFT-like SPL ticket
- View their tickets and check in
- (If organizer) withdraw funds collected by an event

---

## Tech Stack

- **React + TypeScript**
- **Vite** (fast dev tooling)
- **SCSS modules** for styling
- **@solana/web3.js** for RPC & PDAs
- **@coral-xyz/anchor** for client-side program interface
- **@solana/wallet-adapter** for wallet integration (Phantom, Solflare, etc.)
- **@solana/spl-token** for mint + ATA creation

---

## Project Structure (Frontend)

High-level structure (only the important bits):

```text
src/
  solana/
    config.ts         # Connection, PROGRAM_ID, IDL imports, coder, discriminators
    hooks.ts          # useProgram, useEvents, useTickets
    types.ts          # TS types for EventAccount, TicketAccount
    utils.ts          # utf8, bnToLe8, helpers
    idl.json          # Anchor IDL for the program

  components/
    layout/
      AppLayout.tsx   # Main layout & tabbed interface
      AppLayout.scss
      HeaderBar.tsx
      HeaderBar.scss
      StatusBanner.tsx
      StatusBanner.scss

    panels/
      EventsPanel.tsx      # List of events
      EventsPanel.scss
      TicketsPanel.tsx     # List of tickets
      TicketsPanel.scss

    forms/
      CreateEventCard.tsx  # Form to create an event
      CreateEventCard.scss
      JoinEventCard.tsx    # Form to join & mint ticket
      JoinEventCard.scss
      WithdrawCard.tsx     # Form to withdraw event funds
      WithdrawCard.scss

  main.tsx             # React root, ConnectionProvider, WalletProvider, etc.
  polyfills.ts         # Buffer/TextEncoder polyfills if needed
```

---

## Environment Setup

### 1. Prerequisites

- Node.js (LTS, e.g. 18+)
- pnpm / yarn / npm (your choice)
- A Solana devnet wallet with some devnet SOL (e.g. Phantom)

### 2. Install Dependencies

```bash
# pnpm
pnpm install

# or yarn
yarn

# or npm
npm install
```

### 3. Environment Variables

Create a `.env` (or `.env.local`) in the frontend root (same level as `package.json`):

```bash
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

If you omit this, the app will fall back to:

- `clusterApiUrl("devnet")` from `@solana/web3.js`.

### 4. Program ID & IDL

Make sure the frontend is using the correct program:

- In `src/solana/config.ts`:

```ts
import idl from "./idl.json";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";

export const FULL_IDL = idl;
export const PROGRAM_ID = new PublicKey(FULL_IDL.address); // Must match on-chain program

export const DEVNET_ENDPOINT =
  import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl("devnet");

export const connection = new Connection(DEVNET_ENDPOINT, "confirmed");
```

Ensure `idl.json` was generated from your deployed Anchor program and includes the correct `"address"` field (`EASxLwbj...SUBC`).

---

## Running the Frontend

### Development

```bash
# pnpm
pnpm dev

# or
yarn dev

# or
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

### Build for Production

```bash
# pnpm
pnpm build

# or
yarn build

# or
npm run build
```

Serve the `dist/` folder with your favorite static host or preview it locally:

```bash
pnpm preview
# or
npm run preview
```

---

## Using the dApp

### 1. Connect Wallet

- Click the wallet button in the header (**Phantom/Solflare** supported via wallet-adapter).
- Ensure your wallet is set to **Devnet**.

### 2. Explore Tab

- See a list of **on-chain events**.
- Each event card shows:
  - Title, description
  - Price in SOL
  - Organizer address
  - Event PDA

### 3. My Tickets

- Shows tickets owned by your connected wallet.
- For each ticket:
  - Event reference + title
  - Mint address
  - Checked-in status
  - A **Check In** button if relevant (depending on logic/UI).

### 4. Organizer Tab

- **Create Event**:
  - Set price (in SOL), title, description.
  - Event ID is auto-generated based on timestamp (as a `u64` in the program).
- **Withdraw**:
  - Choose one of your events.
  - Enter amount in SOL to withdraw (0 = withdraw all available).
  - Funds move from the `Event` PDA account back to your wallet.

---

## Solana Integration Details (Frontend)

- `useProgram()` builds an Anchor `Program` instance from `FULL_IDL` + `AnchorProvider`.
- `useEvents()`:
  - Uses `connection.getProgramAccounts(PROGRAM_ID, filters)` with the `Event` discriminator to fetch all `Event` accounts.
  - Decodes them using `coder.accounts.decode("Event", data)`.
- `useTickets(owner)`:
  - Similar pattern, with `Ticket` discriminator and a memcmp filter on `owner`.
- `handleCreateEvent`:
  - Generates `event_id` (BN based on `Date.now()`).
  - Calls `init_event` with `(event_id, price_sol, title, description)`.
- `handleJoinEvent`:
  - Creates an SPL mint and ATA client-side.
  - Derives PDA mint authority.
  - Calls `join_event` with mint, mint authority PDA, buyer ATA, and ticket PDA.

---

## Troubleshooting

- **Program ID mismatch**:  
  Make sure your `idl.json` address matches the deployed on-chain program ID.
- **Missing Buffer/TextEncoder** in browser:  
  Ensure `polyfills.ts` sets:
  ```ts
  import { Buffer } from "buffer";
  (globalThis as any).Buffer = Buffer;
  ```
- **Wallet not connecting**:  
  Ensure you’ve installed Phantom/Solflare and set the wallet network to **Devnet**.
- **No events showing**:  
  Check your devnet program is deployed and you’ve created at least one event.
