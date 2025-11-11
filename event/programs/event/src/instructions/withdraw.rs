use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed,system_instruction};

use crate::events::Withdrawn;
use crate::errors::EventError;
use crate::states::Event;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"event",event.organizer.as_ref(),&event.event_id.to_le_bytes()],
        bump = event.bump
    )]
    pub event: Account<'info,Event>,

    pub system_program: Program<'info,System>,
}

pub fn _withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let event = &ctx.accounts.event;
    let signer = &ctx.accounts.signer;

    require_keys_eq!(signer.key(), event.organizer, EventError::Unauthorized);

    let event_ai = ctx.accounts.event.to_account_info();
    let signer_ai = ctx.accounts.signer.to_account_info();

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

    Ok(())
}