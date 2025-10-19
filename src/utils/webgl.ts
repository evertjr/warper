import * as THREE from "three";

const displacementParamCache = new WeakMap<
  THREE.WebGLRenderer,
  THREE.RenderTargetOptions
>();

const hasExtension = (
  renderer: THREE.WebGLRenderer,
  name:
    | "OES_texture_rg"
    | "OES_texture_half_float"
    | "OES_texture_half_float_linear"
    | "EXT_color_buffer_half_float",
) => {
  try {
    return renderer.extensions.has(name);
  } catch {
    return false;
  }
};

export const getDisplacementRenderTargetParams = (
  renderer: THREE.WebGLRenderer,
) => {
  const cached = displacementParamCache.get(renderer);
  if (cached) return cached;

  const isWebGL2 = renderer.capabilities.isWebGL2;
  const supportsRG = isWebGL2 || hasExtension(renderer, "OES_texture_rg");

  const supportsHalfFloat =
    isWebGL2 ||
    hasExtension(renderer, "OES_texture_half_float") ||
    hasExtension(renderer, "EXT_color_buffer_half_float");

  const supportsHalfFloatLinear =
    supportsHalfFloat &&
    (isWebGL2 || hasExtension(renderer, "OES_texture_half_float_linear"));

  const textureType = supportsHalfFloat
    ? THREE.HalfFloatType
    : THREE.UnsignedByteType;
  const useLinearFilter =
    textureType === THREE.UnsignedByteType || supportsHalfFloatLinear;
  const filter = useLinearFilter ? THREE.LinearFilter : THREE.NearestFilter;

  const params: THREE.RenderTargetOptions = {
    minFilter: filter,
    magFilter: filter,
    format: supportsRG ? THREE.RGFormat : THREE.RGBAFormat,
    type: textureType,
    depthBuffer: false,
    stencilBuffer: false,
  };

  displacementParamCache.set(renderer, params);
  return params;
};

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
