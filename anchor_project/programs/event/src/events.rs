use anchor_lang::prelude::*;

#[event]
pub struct CreateEvent {
    pub event: Pubkey,
    pub organizer: Pubkey,
    pub event_id: u64,
}

#[event]
pub struct CreateTicket {
    pub ticket: Pubkey,
    pub event: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct CheckedIn {
    pub ticket: Pubkey,
    pub at: i64,
}

#[event]
pub struct Withdrawn {
    pub event: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct JoinedEvent {
    pub event: Pubkey,
    pub attendee: Pubkey,
}