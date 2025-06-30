import * as THREE from "three";

// Helper constant for displacement render target parameters
export const DISP_RT_PARAMS = {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  type: THREE.HalfFloatType,
  depthBuffer: false,
  stencilBuffer: false,
  colorSpace: THREE.LinearSRGBColorSpace,
} as const;

// Mobile optimization constants - keep quality high but manage memory better
export const MAX_HISTORY_SIZE = 15; // Consistent history size

// Detect if we're on a mobile device
export const isMobileDevice = () => {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
  );
};

// Memory management utilities
export const disposeRenderTarget = (rt: THREE.WebGLRenderTarget) => {
  if (rt) {
    rt.texture.dispose();
    rt.dispose();
  }
};

export const cleanupHistory = (
  history: THREE.Texture[],
  maxSize: number = MAX_HISTORY_SIZE,
  originalState?: THREE.Texture | null,
) => {
  if (history.length <= maxSize) return history;

  const toDispose = history.slice(0, history.length - maxSize);
  toDispose.forEach((texture) => {
    // Never dispose the original state texture
    if (texture && texture.dispose && texture !== originalState) {
      texture.dispose();
    }
  });

  return history.slice(history.length - maxSize);
};
