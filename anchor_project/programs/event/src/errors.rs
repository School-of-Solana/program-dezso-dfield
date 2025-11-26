use anchor_lang::prelude::*;

#[error_code]
pub enum EventError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("There is not enugh funds available")]
    NoFunds,
    #[msg("The ticket is not for this event")]
    WrongEvent,
    #[msg("Ticket Already checked in")]
    AlreadyCheckedIn,
}