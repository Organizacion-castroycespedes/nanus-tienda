import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { createProductAddedSoundPlayer } from "./product-added-sound";

const globalAny = globalThis as typeof globalThis & {
  window?: unknown;
  Audio?: typeof Audio;
};

afterEach(() => {
  delete globalAny.window;
  delete globalAny.Audio;
});

describe("createProductAddedSoundPlayer", () => {
  it("returns false when window is unavailable", async () => {
    const play = createProductAddedSoundPlayer();

    await assert.doesNotReject(() => play());
    assert.equal(await play(), false);
  });

  it("plays the approved sound once per successful add", async () => {
    const playCalls: string[] = [];

    class MockAudio {
      public preload = "";
      public currentTime = 0;
      constructor(public src: string) {}
      play = async () => {
        playCalls.push(this.src);
      };
    }

    globalAny.window = {} as never;
    globalAny.Audio = MockAudio as unknown as typeof Audio;

    const play = createProductAddedSoundPlayer();

    assert.equal(await play(), true);
    assert.equal(await play(), true);
    assert.deepEqual(playCalls, ["/sounds/product-added-p.mp3", "/sounds/product-added-p.mp3"]);
  });

  it("returns false when playback fails", async () => {
    class MockAudio {
      public preload = "";
      public currentTime = 0;
      constructor(public src: string) {}
      play = async () => {
        throw new Error("blocked");
      };
    }

    globalAny.window = {} as never;
    globalAny.Audio = MockAudio as unknown as typeof Audio;

    const play = createProductAddedSoundPlayer();

    assert.equal(await play(), false);
  });
});
