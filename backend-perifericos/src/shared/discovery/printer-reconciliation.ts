export type PhysicalUsbPrinter = { nativeIdentifier: string; name: string; fingerprint?: Record<string, string> };
export type WindowsPrintQueue = { name: string; portName: string; nativeIdentifier?: string };
export type NormalizedPrinter = PhysicalUsbPrinter & { queueInstalled: boolean; physicalDetected: boolean; status: "DISCOVERED" | "OFFLINE" | "CONNECTED"; windowsQueueName?: string };

export const reconcilePrinters = (physical: PhysicalUsbPrinter[], queues: WindowsPrintQueue[]): NormalizedPrinter[] => {
  const result: NormalizedPrinter[] = physical.map((item) => ({ ...item, queueInstalled: false, physicalDetected: true, status: "DISCOVERED" }));
  const matched = new Set<number>();
  for (const queue of queues) {
    const index = result.findIndex((item, i) => !matched.has(i) && Boolean(queue.nativeIdentifier) && queue.nativeIdentifier === item.nativeIdentifier);
    if (index >= 0) { matched.add(index); result[index] = { ...result[index], queueInstalled: true, status: "CONNECTED", windowsQueueName: queue.name }; continue; }
    result.push({ name: queue.name, nativeIdentifier: queue.nativeIdentifier ?? `queue:${queue.name}`, queueInstalled: true, physicalDetected: false, status: "OFFLINE", windowsQueueName: queue.name });
  }
  return result;
};
