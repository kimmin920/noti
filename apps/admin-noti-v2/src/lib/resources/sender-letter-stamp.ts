export type SenderLetterStamp = {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function buildDefaultSenderLetterStamp(): SenderLetterStamp {
  return {
    dataUrl: "",
    x: 26,
    y: 14,
    width: 64,
    height: 64,
  };
}
