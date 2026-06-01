export class FiscalLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalLookupError";
  }
}
