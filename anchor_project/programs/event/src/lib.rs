use anchor_lang::prelude::*;

mod instructions;
mod errors;
mod states;
mod events;

pub use instructions::*;

declare_id!("HK43FpG11qhqwHZT8ZuKqn8FPFpbYJj59QL1qvFpm1tx");

#[program]
pub mod event {
    use super::*;

    pub fn init_event(
        ctx:Context<InitEvent>,
        event_id: u64,
        price_sol: u64,
        title: String,
        description: String,
    ) -> Result<()> {
        _init_event(ctx, event_id, price_sol, title, description)
    }

    pub fn init_ticket(ctx:Context<InitTicket>) -> Result<()> {
        _init_ticket(ctx)
    }

    pub fn join_event(ctx:Context<JoinEvent>) -> Result<()> {
        _join_event(ctx)
    }

    pub fn check_in(ctx:Context<CheckIn>) -> Result<()> {
        _check_in(ctx)
    }

    pub fn withdraw(ctx:Context<Withdraw>, amount: u64) -> Result<()> {
        _withdraw(ctx, amount)
    }
}

