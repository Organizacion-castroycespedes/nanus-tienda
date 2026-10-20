export type ScaleWeightRequest = {
  terminalId?: string;
  deviceId?: string;
};

export type ScaleWeightResponse = {
  deviceId: string;
  weight: number;
  unit: "kg" | null;
  stable: boolean | null;
  source: "MOCK" | "REAL";
  unitVerified: boolean;
  stabilityVerified: boolean;
  timestamp: string;
};
