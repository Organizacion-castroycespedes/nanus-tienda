export const EscPosMockCommandName = {
  Init: "INIT",
  AlignLeft: "ALIGN_LEFT",
  AlignCenter: "ALIGN_CENTER",
  AlignRight: "ALIGN_RIGHT",
  BoldOn: "BOLD_ON",
  BoldOff: "BOLD_OFF",
  DoubleHeightOn: "DOUBLE_HEIGHT_ON",
  DoubleHeightOff: "DOUBLE_HEIGHT_OFF",
  Feed: "FEED",
  Cut: "CUT",
  CashDrawerPulse: "CASH_DRAWER_PULSE",
  QrCode: "QR_CODE",
} as const;

export type EscPosMockCommandName =
  (typeof EscPosMockCommandName)[keyof typeof EscPosMockCommandName];

export type EscPosMockCommand = {
  name: EscPosMockCommandName;
  description: string;
  payload?: string;
  size?: number;
  errorCorrection?: "L" | "M" | "Q" | "H";
};

export type ThermalTicketItem = {
  name: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
};

export type ThermalTicketPayment = {
  method: string;
  amount?: number;
};

export type ThermalTicketContent = {
  qrPayload?: string;
  header?: string;
  businessName?: string;
  nit?: string;
  address?: string;
  cashier?: string;
  documentNumber?: string;
  saleNumber?: string;
  date?: string;
  items?: ThermalTicketItem[];
  subtotal?: number;
  taxes?: number;
  discounts?: number;
  total?: number;
  paid?: number;
  change?: number;
  balance?: number;
  payments?: ThermalTicketPayment[];
  footer?: string;
  title?: string;
  lines?: string[];
};

export type ThermalMockDocument = {
  preview: string;
  commands: EscPosMockCommand[];
  widthChars: number;
};
