import type { InventoryCaptureMode } from "./barcode-lines";

/** Mensajes y sonidos de la captura con lector en pedidos y compras (D12). */

export type InventoryScanTone = "success" | "info" | "warning" | "error";

export type InventoryScanFeedback = {
  tone: InventoryScanTone;
  message: string;
  /** Marca de tiempo para volver a anunciar mensajes idénticos. */
  at: number;
};

export const createInventoryScanFeedback = (
  tone: InventoryScanTone,
  message: string
): InventoryScanFeedback => ({ tone, message, at: Date.now() });

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);

const modeLabel = (mode: InventoryCaptureMode) => (mode === "WEIGHT" ? "peso" : "unidad");

export const inventoryScanMessages = {
  added: (name: string, quantity: number) => `Agregado: ${name} (cantidad ${formatQuantity(quantity)})`,
  prepared: (name: string, remaining: number) =>
    `Preparado: ${name} (pendiente ${formatQuantity(remaining)})`,
  notFound: (code: string) => `Código no encontrado: ${code}`,
  ambiguous: (code: string, count: number) =>
    `Código ambiguo: ${code} coincide con ${count} productos. Elige uno de la lista.`,
  presentationUnsupported: (code: string) =>
    `Presentación sin factor de conversión configurado (${code}). Agrega el producto por unidad.`,
  outOfScope: (name: string) => `El producto no pertenece a esta compra: ${name}`,
  exceedsPending: (name: string, remaining: number) =>
    `Excede la cantidad pendiente de ${name} (pendiente: ${formatQuantity(remaining)})`,
  modeMismatch: (name: string, mode: InventoryCaptureMode) =>
    `La línea de ${name} está en modo ${modeLabel(mode)}; no se puede mezclar unidad y peso.`,
  invalidQuantity: () => "Cantidad inválida: debe ser mayor a 0 y tener máximo 2 decimales.",
  duplicateIgnored: (code: string) => `Lectura repetida ignorada: ${code}`,
} as const;

const SUCCESS_SOUND_SRC = "/sounds/product-added-p.mp3";

export type InventoryScanSoundPlayer = {
  success: () => void;
  error: () => void;
};

/** Sonidos tolerantes a fallos: si el navegador bloquea audio, no hace nada. */
export const createInventoryScanSoundPlayer = (): InventoryScanSoundPlayer => {
  let successAudio: HTMLAudioElement | null = null;
  let audioContext: AudioContext | null = null;

  const success = () => {
    if (typeof window === "undefined" || typeof Audio === "undefined") {
      return;
    }
    try {
      successAudio ??= new Audio(SUCCESS_SOUND_SRC);
      successAudio.currentTime = 0;
      void successAudio.play()?.catch(() => undefined);
    } catch {
      // Audio no disponible.
    }
  };

  const error = () => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }
      audioContext ??= new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = 220;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.18);
    } catch {
      // Audio no disponible.
    }
  };

  return { success, error };
};
