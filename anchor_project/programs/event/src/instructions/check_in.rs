use anchor_lang::prelude::*;

use crate::events::CheckedIn;
use crate::errors::EventError;
use crate::states::{Event, Ticket};

#[derive(Accounts)]
pub struct CheckIn<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"event", event.organizer.as_ref(), &event.event_id.to_le_bytes()],
        bump = event.bump,
    )]
    pub event: Account<'info, Event>,

    #[account(
        mut,
        seeds = [b"ticket", event.key().as_ref(), ticket.owner.as_ref()],
        bump = ticket.bump,
    )]
    pub ticket: Account<'info, Ticket>,

    pub system_program: Program<'info, System>,
}

pub fn _check_in(ctx: Context<CheckIn>) -> Result<()> {
    let signer = &ctx.accounts.signer;
    let event = &ctx.accounts.event;
    let ticket = &mut ctx.accounts.ticket;

    require_keys_eq!(event.organizer, signer.key(), EventError::Unauthorized);
    require_keys_eq!(ticket.event, event.key(), EventError::WrongEvent);
    require!(!ticket.checked_in, EventError::AlreadyCheckedIn);

    ticket.checked_in = true;

    emit!(CheckedIn {
        ticket: ticket.key(),
        at: Clock::get()?.unix_timestamp,
    });

    Ok(())
}