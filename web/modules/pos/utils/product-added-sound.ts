const PRODUCT_ADDED_SOUND_SRC = "/sounds/product-added-p.mp3";

export const createProductAddedSoundPlayer = () => {
  let audio: HTMLAudioElement | null = null;

  return async () => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      if (!audio) {
        audio = new Audio(PRODUCT_ADDED_SOUND_SRC);
        audio.preload = "auto";
      }

      audio.currentTime = 0;
      const result = audio.play();
      if (result && typeof result.then === "function") {
        await result;
      }
      return true;
    } catch {
      return false;
    }
  };
};
