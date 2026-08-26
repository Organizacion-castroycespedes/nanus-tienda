export type PrinterTransportInput = {
  nativeIdentifier: string;
  payload: Buffer;
  jobName: string;
};

export type PrinterTransportResult = {
  bytesSent: number;
};

/** Portable output port. Platform adapters own the actual spooler call. */
export interface PrinterTransport {
  readonly transportName: string;
  send(input: PrinterTransportInput): PrinterTransportResult;
}
