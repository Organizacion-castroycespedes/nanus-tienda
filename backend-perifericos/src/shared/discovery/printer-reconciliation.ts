export type PhysicalUsbPrinter = { nativeIdentifier: string; name: string; deviceId?: string; fingerprint?: Record<string, string> };
export type WindowsPrintQueue = { name: string; portName: string; nativeIdentifier?: string; ready?: boolean };
export type ExplicitPrinterBinding = { physicalDeviceId?: string; physicalNativeIdentifier?: string; queueName: string };
export type NormalizedPrinter = PhysicalUsbPrinter & { queueInstalled: boolean; physicalDetected: boolean; status: "DISCOVERED" | "OFFLINE" | "CONNECTED"; windowsQueueName?: string };

export const reconcilePrinters = (
  physical: PhysicalUsbPrinter[],
  queues: WindowsPrintQueue[],
  explicitBindings: ExplicitPrinterBinding[] = [],
): NormalizedPrinter[] => {
  const result: NormalizedPrinter[] = physical.map((item) => ({ ...item, queueInstalled: false, physicalDetected: true, status: "DISCOVERED" }));
  const matched = new Set<number>();
  const consumedQueues = new Set<number>();
  for (const queue of queues) {
    const index = result.findIndex((item, i) => !matched.has(i) && Boolean(queue.nativeIdentifier) && queue.nativeIdentifier === item.nativeIdentifier);
    if (index >= 0) { matched.add(index); consumedQueues.add(queues.indexOf(queue)); result[index] = { ...result[index], queueInstalled: true, status: "CONNECTED", windowsQueueName: queue.name }; continue; }
  }
  for (const binding of explicitBindings) {
    const physicalIndex = result.findIndex((item, index) => !matched.has(index) &&
      ((binding.physicalDeviceId && item.deviceId === binding.physicalDeviceId) ||
       (binding.physicalNativeIdentifier && item.nativeIdentifier === binding.physicalNativeIdentifier)));
    const candidates = queues
      .map((queue, index) => ({ queue, index }))
      .filter(({ queue }) => queue.name === binding.queueName && queue.ready !== false && !consumedQueues.has(queues.indexOf(queue)));
    if (physicalIndex < 0 || candidates.length !== 1) continue;
    const [{ queue, index: queueIndex }] = candidates;
    matched.add(physicalIndex);
    consumedQueues.add(queueIndex);
    result[physicalIndex] = { ...result[physicalIndex], queueInstalled: true, status: "CONNECTED", windowsQueueName: queue.name };
  }
  for (let queueIndex = 0; queueIndex < queues.length; queueIndex += 1) {
    if (consumedQueues.has(queueIndex)) continue;
    const queue = queues[queueIndex];
    result.push({ name: queue.name, nativeIdentifier: queue.nativeIdentifier ?? `queue:${queue.name}`, queueInstalled: true, physicalDetected: false, status: "OFFLINE", windowsQueueName: queue.name });
  }
  return result;
};
