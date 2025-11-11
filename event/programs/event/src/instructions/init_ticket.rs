use anchor_lang::prelude::*;

use crate::events::CreateTicket;
use crate::states::{Event,Ticket};

#[derive(Accounts)]
pub struct InitTicket<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub event: Account<'info,Event>,

    #[account(
        init,
        payer = signer,
        seeds = [b"ticket",event.key().as_ref(),owner.key().as_ref()],
        space = 8 + Ticket::INIT_SPACE,
        bump
    )]
    pub ticket: Account<'info,Ticket>,

    pub owner: SystemAccount<'info>,

    pub system_program: Program<'info,System>,
}

pub fn _init_ticket(
    ctx:Context<InitTicket>
) -> Result<()> {
    let bump = ctx.bumps.ticket;
    let ticket = &mut ctx.accounts.ticket;
    ticket.owner = ctx.accounts.owner.key();
    ticket.mint = Pubkey::default();
    ticket.event = ctx.accounts.event.key();
    ticket.checked_in = false;
    ticket.bump = bump;

    emit!(CreateTicket {
        ticket: ticket.key(),
        event: ticket.event,
        owner: ticket.owner,
    });

    Ok(())
}