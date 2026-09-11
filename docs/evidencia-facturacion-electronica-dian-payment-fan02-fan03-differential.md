# DIAN FAN02/FAN03 payment differential

- Scope: read-only comparison for `SETP990000006` against accepted QA documents.
- No document, database, XML, provider, or transmission mutation occurred.

## Database comparison

| Field | SETP990000006 | SETP990000005 | SETP990000003 | SETP990000002 |
|---|---|---|---|---|
| Status | REJECTED | ACCEPTED | ACCEPTED | ACCEPTED |
| invoiceTypeCode | 01 | 01 | 01 | 01 |
| operationType | 10 | 10 | 10 | 10 |
| paymentMeansCode | CASH | 10 | 10 | 10 |
| paymentMeansId | CASH | 1 | 1 | 1 |

All golden documents had one accepted transmission attempt; `SETP990000002` also has historical refresh attempts.

## XML comparison

The rejected signed XML contains one `cac:PaymentMeans` block with:

- `cbc:ID`: CASH
- `cbc:PaymentMeansCode`: CASH

The rejected XML is not DIAN-valid for these payment fields. Golden signed XML files were not available under the current local storage path, but their persisted document rows consistently contain `10` / `1`.

## Provenance and mapping

- FactuCore XML generator maps `document.paymentMeansId` to `cac:PaymentMeans/cbc:ID` and `document.paymentMeansCode` to `cac:PaymentMeans/cbc:PaymentMeansCode`.
- FactuCore document creation persists the incoming DTO fields without translating the business value.
- Manus sale-event mapping takes `primaryPayment.methodCode` directly as `payment.methodCode`.
- FactuCore provider mapping takes that method code directly for both `paymentMeansCode` and `paymentMeansId`.
- The observed first invalid value is therefore upstream of XML generation: the business value `CASH` crossed the Manus/FactuCore contract without a DIAN payment-code translation.

## FAN rules

- FAN02 maps to the invalid payment method value represented by `PaymentMeansCode` / `payment_means_code`: CASH instead of the accepted DIAN code 10.
- FAN03 maps to the invalid payment identifier/value represented by `PaymentMeans/cbc:ID` / `payment_means_id`: CASH instead of the accepted identifier 1.
- Code 99 is the DIAN terminal rejection containing these blocking FAN02/FAN03 rules.

## Notifications

FAK41, FAZ09, FAK40, and FAJ43b are separate notifications from the payment rejection. They were not used to invent a payment fix. Exact golden notification comparison was not available from the current captured response.

## Decision

- FAN02 root cause: identified.
- FAN03 root cause: identified.
- Correct payment values: identified from accepted QA rows: code 10 and identifier 1.
- Recommended fix location: Manus/provider contract normalization, before FactuCore request serialization.
- No code fix was applied in this read-only task.
- `SETP990000006` remains terminally rejected and must not be retransmitted.
