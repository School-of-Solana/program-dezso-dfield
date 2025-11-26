use anchor_lang::prelude::*;

pub const TITLE_LENGTH: usize = 50;
pub const DESCRIPTION_LENGTH: usize = 500;


#[account]
#[derive(InitSpace)]
pub struct Event {
    pub price: u64,

    #[max_len(TITLE_LENGTH)]
    pub title: String,

    #[max_len(DESCRIPTION_LENGTH)]
    pub description: String,
    
    pub organizer: Pubkey,
    pub event_id: u64,
    pub bump: u8,
}


#[account]
#[derive(InitSpace)]
pub struct Ticket {
    pub event: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub checked_in:bool,
    pub bump: u8,
}