export class ElectronicBillingSaleEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElectronicBillingSaleEventValidationError";
  }
}

export class ElectronicBillingSaleEventTemporaryFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElectronicBillingSaleEventTemporaryFailureError";
  }
}
