use anchor_lang::error_code;

#[error_code]
pub enum ValidationError {
    #[msg("Only allowed by owner.")]                                            OwnerRequired,
    #[msg("Resource has too many inputs defined.")]                             ResourceInputMax,
    #[msg("Resource types doesn't match.")]                                     ResourceNotMatching,
    #[msg("Missing resource input amount.")]                                    MissingResourceInputAmount,
    #[msg("Missing resource account.")]                                         MissingResource,
    #[msg("Input storage not supplied to production.")]                         InputStorageNotSupplied,
    #[msg("Input storage 1 not supplied to production.")]                       InputStorage1NotSupplied,
    #[msg("Input storage 2 not supplied to production.")]                       InputStorage2NotSupplied,
    #[msg("Input storage amount is too low.")]                                  InputStorageAmountTooLow,
    #[msg("Storage is full.")]                                                  StorageFull,
    #[msg("Not enough in storage.")]                                            StorageAmountTooLow,
    #[msg("Name too long.")]                                                    NameTooLong,
    #[msg("Locations are different.")]                                          DifferentLocations,
    #[msg("Location is full.")]                                                 LocationFull,
    #[msg("Storage type static cannot be moved.")]                              StorageTypeNotMovable,
    #[msg("This is not allowed while moving.")]                                 NotAllowedWhileMoving,
    #[msg("Processor type 'producer' required.")]                               InvalidProcessorType,
    #[msg("Fuel not supplied to processor.")]                                   FuelNotSupplied,
    #[msg("Not enough fuel.")]                                                  FuelNotEnough,
    #[msg("Location has not yet been explored.")]                               LocationUnexplored,
    #[msg("Invalid input parameter.")]                                          InvalidInput,
    #[msg("Trying stuff out and failing quite deliberately.")]                  ExperimentalError,
}
