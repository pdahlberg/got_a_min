use anchor_lang::error_code;

#[error_code]
pub enum ValidationError {
    #[msg("Resource has too many inputs defined.")]                             ResourceInputMax,
    #[msg("Missing resource input amount.")]                                    MissingResourceInputAmount,
    #[msg("Missing resource account.")]                                         MissingResource,
    #[msg("Input storage not supplied to production.")]                         InputStorageNotSupplied,
    #[msg("Input storage 1 not supplied to production.")]                       InputStorage1NotSupplied,
    #[msg("Input storage 2 not supplied to production.")]                       InputStorage2NotSupplied,
    #[msg("Input storage amount is too low.")]                                  InputStorageAmountTooLow,
    #[msg("Storage is full.")]                                                  StorageFull,
    #[msg("Name too long.")]                                                    NameTooLong,
    #[msg("Trying stuff out and failing quite deliberately.")]                  ExperimentalError,
}
