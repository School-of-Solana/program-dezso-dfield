use anchor_lang::prelude::*;

const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

use crate::states::Event;
use crate::events::CreateEvent;

#[derive(Accounts)]
#[instruction(event_id:u64)]
pub struct InitEvent<'info> {
    #[account(mut)]
    signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 + Event::INIT_SPACE,
        seeds = [b"event", signer.key().as_ref(),&event_id.to_le_bytes()],
        bump
    )]
    pub event: Account<'info,Event>,

    pub system_program: Program<'info,System>,
}

pub fn _init_event(
    ctx: Context<InitEvent>,
    event_id: u64,
    price_lamports: u64,
    title: String,
    description: String,
) -> Result<()> {
    let event_bump = ctx.bumps.event;
    let event = &mut ctx.accounts.event;

    event.price = price_lamports;
    event.title = title;
    event.event_id = event_id;
    event.description = description;
    event.organizer = ctx.accounts.signer.key();
    event.bump = event_bump;

    emit!(CreateEvent {
        event: event.key(),
        organizer: event.organizer,
        event_id,
    });

    Ok(())
}