export const fontRegistry = {
  geist: { label: "Geist Sans", variable: "--font-geist" },
  geistMono: { label: "Geist Mono", variable: "--font-geist-mono" },
  geistPixelSquare: { label: "Geist Pixel Square", variable: "--font-geist-pixel-square" },
} as const;

export type FontKey = keyof typeof fontRegistry;
export const fontOptions = Object.entries(fontRegistry).map(([key, font]) => ({
  key: key as FontKey,
  ...font,
}));
