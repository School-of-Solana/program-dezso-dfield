# Solana Event dApp – Program (Anchor)

This is the **Solana program** (smart contract) for the Event dApp.  
It is written in **Rust** using **Anchor** and deployed to **devnet**.

---

## Program Info

- **Name:** `event`
- **Cluster:** `devnet`
- **Program ID:** `EASxLwbjSfJn75XGj1aHtA17jSc7xCSkuAcMnwJbSUBC`

---

## Prerequisites

- **Rust** (stable) with Cargo
- **Solana CLI** (configured to devnet):

  ```bash
  solana config set --url https://api.devnet.solana.com
  ```

- **Anchor CLI**:

  ```bash
  cargo install --git https://github.com/coral-xyz/anchor avm --locked
  avm install latest
  avm use latest
  ```

- A devnet keypair with SOL:

  ```bash
  solana-keygen new -o ~/.config/solana/id.json
  solana airdrop 2 # on devnet
  ```

---

## Project Structure (Program)

Typical structure:

```text
programs/
  event/
    src/
      lib.rs         # main program module, instruction entrypoints
      instructions/  # each instruction logic (_init_event, _join_event, etc.)
      states.rs      # Event, Ticket account structs + INIT_SPACE
      errors.rs      # Custom error types
      events.rs      # Anchor events emitted by instructions
    Cargo.toml
    Anchor.toml (root)
```

Key modules:

- `lib.rs` – defines the `#[program]` module and exposes:
  - `init_event`
  - `init_ticket`
  - `join_event`
  - `check_in`
  - `withdraw`
- `instructions/` – implementation of `_init_event`, `_init_ticket`, `_join_event`, `_check_in`, `_withdraw`.
- `states.rs` – the `Event` and `Ticket` account definitions.
- `errors.rs` – `EventError` enum with custom errors (e.g., `Unauthorized`, `AlreadyCheckedIn`).
- `events.rs` – Anchor events like `CreateEvent`, `CreateTicket`, `JoinedEvent`, `CheckedIn`, `Withdrawn`.

---

## Accounts & PDAs

### Event Account

```rust
#[account]
pub struct Event {
    pub price: u64,        // ticket price in lamports
    pub title: String,     // event title
    pub description: String,
    pub event_id: u64,     // unique identifier (from client)
    pub organizer: Pubkey, // organizer wallet
    pub bump: u8,          // PDA bump
}
```

**PDA Derivation:**

```rust
// Seeds: ["event", organizer, event_id_le_bytes]
seeds = [b"event", signer.key().as_ref(), &event_id.to_le_bytes()],
bump
```

### Ticket Account

```rust
#[account]
pub struct Ticket {
    pub event: Pubkey,     // associated event
    pub owner: Pubkey,     // ticket owner
    pub mint: Pubkey,      // SPL token mint used as NFT
    pub checked_in: bool,  // whether user has checked in
    pub bump: u8,          // PDA bump
}
```

**PDA Derivation:**

```rust
// Seeds: ["ticket", event_pubkey, owner_pubkey]
seeds = [b"ticket", event.key().as_ref(), signer.key().as_ref()],
bump
```

### Mint Authority PDA

```rust
// Used only as an authority/signature for token::mint_to
#[account(
    seeds = [b"mint_auth", mint.key().as_ref()],
    bump,
)]
pub mint_authority: UncheckedAccount<'info>,
```

**Purpose:** program-derived mint authority for the SPL token that represents an event ticket.

---

## Instructions

### `init_event`

```rust
pub fn init_event(
    ctx: Context<InitEvent>,
    event_id: u64,
    price_sol: u64,
    title: String,
    description: String,
) -> Result<()> {
    _init_event(ctx, event_id, price_sol, title, description)
}
```

**Context:**

```rust
#[derive(Accounts)]
#[instruction(event_id: u64)]
pub struct InitEvent<'info> {
    #[account(mut)]
    signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 + Event::INIT_SPACE,
        seeds = [b"event", signer.key().as_ref(), &event_id.to_le_bytes()],
        bump
    )]
    pub event: Account<'info, Event>,

    pub system_program: Program<'info, System>,
}
```

**Logic Highlights:**

- Converts `price_sol` to lamports:

  ```rust
  const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
  event.price = price_sol.saturating_mul(LAMPORTS_PER_SOL);
  ```

- Stores metadata and emits `CreateEvent`.

---

### `init_ticket`

```rust
pub fn init_ticket(ctx: Context<InitTicket>) -> Result<()> {
    _init_ticket(ctx)
}
```

**Context:**

```rust
#[derive(Accounts)]
pub struct InitTicket<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub event: Account<'info, Event>,

    #[account(
        init,
        payer = signer,
        seeds = [b"ticket", event.key().as_ref(), owner.key().as_ref()],
        space = 8 + Ticket::INIT_SPACE,
        bump
    )]
    pub ticket: Account<'info, Ticket>,

    pub owner: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
```

**Logic Highlights:**

- Initializes a `Ticket` account with default `mint = Pubkey::default()` and `checked_in = false`.
- Emits `CreateTicket`.

---

### `join_event`

```rust
pub fn join_event(ctx: Context<JoinEvent>) -> Result<()> {
    _join_event(ctx)
}
```

**Context:**

```rust
#[derive(Accounts)]
pub struct JoinEvent<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"event", event.organizer.as_ref(), &event.event_id.to_le_bytes()],
        bump = event.bump,
    )]
    pub event: Account<'info, Event>,

    #[account(
        init,
        payer = signer,
        space = 8 + Ticket::INIT_SPACE,
        seeds = [b"ticket", event.key().as_ref(), signer.key().as_ref()],
        bump,
    )]
    pub ticket: Account<'info, Ticket>,

    /// CHECK:
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK:
    #[account(
        seeds = [b"mint_auth", mint.key().as_ref()],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    /// CHECK:
    #[account(mut)]
    pub buyer_ata: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

**Logic Highlights:**

1. **Payment:**

   ```rust
   if event.price > 0 {
       let ix = system_instruction::transfer(&signer.key(), &event.key(), event.price);
       invoke(&ix, &[signer.to_account_info(), event.to_account_info(), ctx.accounts.system_program.to_account_info()])?;
   }
   ```

2. **Mint 1 ticket token:**

   ```rust
   let mint_bump = ctx.bumps.mint_authority;
   let mint_key = ctx.accounts.mint.key();
   let mint_seeds: &[&[u8]] = &[b"mint_auth", mint_key.as_ref(), &[mint_bump]];
   let signer_seeds: &[&[&[u8]]] = &[mint_seeds];

   let cpi = CpiContext::new_with_signer(
       ctx.accounts.token_program.to_account_info(),
       MintTo {
           mint: ctx.accounts.mint.to_account_info(),
           to: ctx.accounts.buyer_ata.to_account_info(),
           authority: ctx.accounts.mint_authority.to_account_info(),
       },
       signer_seeds,
   );
   token::mint_to(cpi, 1)?;
   ```

3. **Initialize Ticket account:**

   ```rust
   let ticket_bump = ctx.bumps.ticket;
   let ticket = &mut ctx.accounts.ticket;
   ticket.event = event.key();
   ticket.owner = signer.key();
   ticket.mint = ctx.accounts.mint.key();
   ticket.checked_in = false;
   ticket.bump = ticket_bump;
   ```

4. Emit `JoinedEvent`.

---

### `check_in`

```rust
pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
    _check_in(ctx)
}
```

**Context & Logic Highlights:**

- Ensures:
  - `ticket.event == event.key()`
  - `ticket.owner == signer.key()`
  - `ticket.checked_in == false`
- Then:

  ```rust
  ticket.checked_in = true;

  emit!(CheckedIn {
      ticket: ticket.key(),
      at: Clock::get()?.unix_timestamp,
  });
  ```

---

### `withdraw`

```rust
pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    _withdraw(ctx, amount)
}
```

**Logic Highlights:**

- Only event organizer can withdraw:

  ```rust
  require_keys_eq!(signer.key(), event.organizer, EventError::Unauthorized);
  ```

- Ensures rent-exempt balance remains in the event account.
- Calculates available lamports and sends either `amount` or all available:

  ```rust
  let lamports = event_ai.lamports();
  let rent_min = Rent::get()?.minimum_balance(event_ai.data_len());
  let available = lamports.saturating_sub(rent_min);

  require!(available > 0, EventError::NoFunds);

  let to_send = if amount == 0 || amount > available {
      available
  } else {
      amount
  };

  **event_ai.try_borrow_mut_lamports()? -= to_send;
  **signer_ai.try_borrow_mut_lamports()? += to_send;
  ```

---

## Building & Deploying

### 1. Build

From the project root (where `Anchor.toml` lives):

```bash
anchor build
```

### 2. Configure Cluster

```bash
solana config set --url https://api.devnet.solana.com
```

### 3. Deploy

```bash
anchor deploy
```

- After deployment, note the **program ID**.
- Update:
  - `Anchor.toml`
  - Frontend `idl.json` / `FULL_IDL.address`
  - Any config constants if necessary

### 4. Generate IDL (if needed)

Anchor automatically outputs IDL to `target/idl/event.json`.  
Copy it into the frontend as `src/solana/idl.json` and ensure the `"address"` field matches the deployed program.

---

## Testing

### Running Tests

Add tests under `tests/` (e.g. `tests/event.ts` or Rust-based tests), then run:

```bash
anchor test
```

Typical tests to implement:

- **Create Event**: verify account data, seeds, and stored values.
- **Join Event**: simulate user join, confirm lamports & ticket state.
- **Check-In**: ensure state flips & unauthorized attempts fail.
- **Withdraw**: confirm only organizer can withdraw and rent is preserved.

---

## Notes

- All monetary values on-chain are stored in **lamports**.  
  The frontend handles converting SOL ↔ lamports.
- PDAs ensure that:
  - Users can’t spoof event accounts.
  - Ticket ownership is structured and verifiable.
  - Mint authority is controlled by the program for ticket tokens.
- This design is intentionally minimal but extensible:
  - Add supply caps, time windows, metadata URLs, etc.
