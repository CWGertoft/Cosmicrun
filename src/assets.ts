const imagePaths = [
  ["black-background", "/assets/original/world/BlackBG.png"],
  ["gate-green", "/assets/original/world/gate-green.png"],
  ["pillar-cyan", "/assets/original/world/pillar-cyan.png"],
  ["station", "/assets/original/world/station.png"],
  ["city", "/assets/original/world/city.png"],
  ["constellation", "/assets/original/world/constellation.png"],
  ["star", "/assets/original/ui/star.png"],
  ["coin-1", "/assets/original/coin/coin1_1_20.png"],
  ["coin-2", "/assets/original/coin/coin2_20.png"],
  ["coin-3", "/assets/original/coin/coin3_20.png"],
  ["coin-4", "/assets/original/coin/coin4_20.png"],
  ["coin-5", "/assets/original/coin/coin5_20.png"],
  ["coin-6", "/assets/original/coin/coin6_20.png"],
  ["coin-7", "/assets/original/coin/coin7_20.png"],
  ["coin-break-1", "/assets/original/coin-break/coinb1_20.png"],
  ["coin-break-2", "/assets/original/coin-break/coinb2_20.png"],
  ["coin-break-3", "/assets/original/coin-break/coinb3_20.png"],
  ["coin-break-4", "/assets/original/coin-break/coinb4_20.png"],
  ["coin-break-5", "/assets/original/coin-break/coinb5_20.png"],
  ["run-1", "/assets/original/player/run/1.png"],
  ["run-2", "/assets/original/player/run/2.png"],
  ["run-3", "/assets/original/player/run/3.png"],
  ["run-4", "/assets/original/player/run/4.png"],
  ["run-5", "/assets/original/player/run/5.png"],
  ["run-6", "/assets/original/player/run/6.png"],
  ["run-7", "/assets/original/player/run/7.png"],
  ["run-8", "/assets/original/player/run/8.png"],
  ["run-9", "/assets/original/player/run/9.png"],
  ["jump-1", "/assets/original/player/jump/jump-1.png"],
  ["jump-2", "/assets/original/player/jump/jump-2.png"],
  ["jump-3", "/assets/original/player/jump/jump-3.png"],
  ["jump-4", "/assets/original/player/jump/jump-4.png"],
  ["jump-5", "/assets/original/player/jump/jump-5.png"],
  ["jump-6", "/assets/original/player/jump/jump-6.png"],
  ["death-1", "/assets/original/player/death/death-1.png"],
  ["death-2", "/assets/original/player/death/death-2.png"],
  ["death-3", "/assets/original/player/death/death-3.png"],
  ["death-4", "/assets/original/player/death/death-4.png"],
  ["death-5", "/assets/original/player/death/death-5.png"],
  ["death-6", "/assets/original/player/death/death-6.png"],
  ["death-7", "/assets/original/player/death/death-7.png"],
] as const;

export const audioPaths = {
  music: "/assets/original/audio/music.mp3",
  hit: "/assets/original/audio/Hit_Hurt4.wav",
  coin: "/assets/original/audio/Pickup_Coin10.wav",
} as const;

export class OriginalAssets {
  private readonly images = new Map<string, HTMLImageElement>();

  public set(key: string, image: HTMLImageElement): void {
    this.images.set(key, image);
  }

  public get(key: string): HTMLImageElement {
    const image = this.images.get(key);
    if (!image) {
      throw new Error(`Saknar originalasset: ${key}`);
    }

    return image;
  }
}

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Kunde inte läsa ${path}`));
    image.src = path;
  });
}

export async function loadOriginalAssets(onProgress: (loaded: number, total: number) => void): Promise<OriginalAssets> {
  const assets = new OriginalAssets();
  let loaded = 0;

  await Promise.all(
    imagePaths.map(async ([key, path]) => {
      const image = await loadImage(path);
      assets.set(key, image);
      loaded += 1;
      onProgress(loaded, imagePaths.length);
    }),
  );

  return assets;
}
