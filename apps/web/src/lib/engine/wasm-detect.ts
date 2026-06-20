export const isWasmSupported = () =>
  typeof WebAssembly === "object" &&
  WebAssembly.validate(
    Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
  );

const isIosDevice = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

export const isMobileDevice = () =>
  isIosDevice() || /Android|Opera Mini/i.test(navigator.userAgent);

const getDeviceMemory = (): number =>
  "deviceMemory" in navigator && typeof navigator.deviceMemory === "number"
    ? navigator.deviceMemory
    : 8;

export const getRecommendedWorkersNb = (): number => {
  const memory = getDeviceMemory();
  const threads = navigator.hardwareConcurrency || 4;

  const maxFromThreads = Math.max(1, Math.floor(threads / 2));

  const maxFromMemory = Math.max(1, Math.floor(memory / 4));

  const maxFromDevice = isMobileDevice() ? 1 : 2;

  const conservative = Math.min(maxFromThreads, maxFromMemory, maxFromDevice);

  return conservative;
};
