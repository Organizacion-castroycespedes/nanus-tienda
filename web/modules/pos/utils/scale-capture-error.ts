import { PeripheralAgentRequestError } from "../../../domains/peripherals/api";

export const getScaleCaptureOperatorMessage = (error: unknown): string | undefined => {
  if (error instanceof PeripheralAgentRequestError && error.code === "SCALE_WEIGHT_ZERO") {
    return "Coloca el producto en la balanza para continuar.";
  }
  return undefined;
};
