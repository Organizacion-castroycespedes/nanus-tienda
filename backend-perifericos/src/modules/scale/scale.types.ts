export type ScaleWeightRequest = {
  terminalId?: string;
  deviceId?: string;
};

export type ScaleWeightResponse = {
  deviceId: string;
  weight: number;
  unit: "kg";
  stable: boolean;
  timestamp: string;
};
