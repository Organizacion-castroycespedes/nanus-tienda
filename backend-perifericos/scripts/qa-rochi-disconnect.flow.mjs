export class RecoveryIdentityError extends Error {
  constructor(message) {
    super(message);
    this.name = "RecoveryIdentityError";
  }
}

export const sanitizePnpId = (pnpId) =>
  pnpId.replace(/\\[^\\]+$/, "\\<instance>");

export const authorizeAndRecover = async ({
  device,
  expectedPnpId,
  initialPath,
  onDetected,
  confirmRecovery,
  reconnect,
  reopen,
}) => {
  if (!device || device.pnpId !== expectedPnpId) {
    throw new RecoveryIdentityError("Recovery PnP identity mismatch");
  }
  if (!/VID_1A86&PID_7523/i.test(device.pnpId)) {
    throw new RecoveryIdentityError("Recovery device is not USB-SERIAL CH340");
  }

  const detected = {
    path: device.path,
    pnpId: sanitizePnpId(device.pnpId),
  };
  onDetected?.(detected);
  await confirmRecovery(detected);

  if (device.path === initialPath) {
    await reconnect();
  } else {
    await reopen(device.path);
  }
  return detected;
};
