use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, MintTo, Token},
};

use crate::events::JoinedEvent;
use crate::states::{Event, Ticket};

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
        // ticket PDA = "ticket" + event + signer
        seeds = [b"ticket", event.key().as_ref(), signer.key().as_ref()],
        bump,
    )]
    pub ticket: Account<'info, Ticket>,

    /// CHECK:
    /// Mint account for the NFT ticket. It is created as an SPL Token mint
    /// on the client side. Here we only use it as the `mint` in `token::mint_to`.
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK:
    /// PDA that acts as mint authority for `mint`.
    /// Seeds = [b"mint_auth", mint.key().as_ref()] are enforced by Anchor.
    /// Used only as the authority in `token::mint_to` with `new_with_signer`.
    #[account(
        seeds = [b"mint_auth", mint.key().as_ref()],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    /// CHECK:
    /// Buyer's associated token account for `mint`, only used as `to` in `mint_to`.
    #[account(mut)]
    pub buyer_ata: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn _join_event(ctx: Context<JoinEvent>) -> Result<()> {
    let event = &ctx.accounts.event;
    let signer = &ctx.accounts.signer;

    // 1) Pay event price if > 0
    if event.price > 0 {
        let ix = system_instruction::transfer(&signer.key(), &event.key(), event.price);

        invoke(
            &ix,
            &[
                signer.to_account_info(),
                event.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    // 2) Seeds for mint authority PDA
    let mint_bump = ctx.bumps.mint_authority;
    let mint_key = ctx.accounts.mint.key();
    let mint_seeds: &[&[u8]] = &[
        b"mint_auth",
        mint_key.as_ref(),
        &[mint_bump],
    ];
    let signer_seeds: &[&[&[u8]]] = &[mint_seeds];

    // 3) Mint 1 token to buyer ATA via CPI
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

    // 4) Fill the Ticket account
    let ticket_bump = ctx.bumps.ticket;
    let ticket = &mut ctx.accounts.ticket;
    ticket.event = event.key();
    ticket.owner = signer.key();
    ticket.mint = ctx.accounts.mint.key();
    ticket.checked_in = false;
    ticket.bump = ticket_bump;

    emit!(JoinedEvent {
        event: event.key(),
        attendee: signer.key(),
    });

    Ok(())
}