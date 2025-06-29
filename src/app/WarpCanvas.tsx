import { useTexture } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  forwardRef,
  Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

// Shader that accumulates displacement into displacement map
const BrushShader = {
  uniforms: {
    uPrevDisp: { value: null }, // previous displacement texture
    uMouse: { value: new THREE.Vector2(0, 0) },
    uPrevMouse: { value: new THREE.Vector2(0, 0) },
    uBrushSize: { value: 0.1 },
    uBrushStrength: { value: 0.1 },
    uAspect: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D uPrevDisp;
    uniform vec2 uMouse;
    uniform vec2 uPrevMouse;
    uniform float uBrushSize;
    uniform float uBrushStrength;
    uniform float uAspect;
    varying vec2 vUv;

    void main() {
      // Read previous displacement
      vec2 disp = texture2D(uPrevDisp, vUv).rg;

      // Compute displacement update
      float dist = length((vUv - uMouse) * vec2(uAspect, 1.0));
      if (dist < uBrushSize) {
        vec2 toMouse = (uMouse - uPrevMouse);
        float normalized = dist / uBrushSize;
        float exponent = mix(1.0, 8.0, clamp(uBrushStrength, 0.0, 1.0));
        float falloff = pow(clamp(1.0 - normalized, 0.0, 1.0), exponent);
        disp += toMouse * falloff * uBrushStrength;
      }

      gl_FragColor = vec4(disp, 0.0, 1.0);
    }
  `,
};

// Shader that displays original texture warped by displacement map
const DisplayShader = {
  uniforms: {
    uTexture: { value: null }, // original image
    uDisplacement: { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D uTexture;
    uniform sampler2D uDisplacement;
    varying vec2 vUv;

    void main() {
      vec2 disp = texture2D(uDisplacement, vUv).rg;
      vec2 sampleUv = vUv - disp;
      vec4 color = texture2D(uTexture, sampleUv);
      // Convert linear to sRGB for display
      color.rgb = pow(color.rgb, vec3(1.0/2.2));
      gl_FragColor = color;
    }
  `,
};

// const WarpShader = {/* legacy */};

// Helper constant for displacement render target parameters
const DISP_RT_PARAMS = {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  type: THREE.HalfFloatType,
  depthBuffer: false,
  stencilBuffer: false,
  colorSpace: THREE.SRGBColorSpace,
} as const;

// Function to create HDR file data in Radiance format
function createHDRFile(
  floatPixels: Float32Array,
  width: number,
  height: number
): Uint8Array {
  // HDR header
  const header = [
    "#?RADIANCE",
    "# Created by Warper App - HDR Export",
    "FORMAT=32-bit_rle_rgbe",
    "EXPOSURE=1.0",
    "GAMMA=1.0",
    "",
    `-Y ${height} +X ${width}`,
    "",
  ].join("\n");

  const headerBytes = new TextEncoder().encode(header);

  // Convert float RGB to RGBE format
  const rgbeData = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const r = Math.max(0, floatPixels[i * 4]); // Ensure non-negative
    const g = Math.max(0, floatPixels[i * 4 + 1]);
    const b = Math.max(0, floatPixels[i * 4 + 2]);

    // Convert to RGBE format (more robust implementation)
    const max = Math.max(r, g, b);

    if (max < 1e-32) {
      // Black pixel
      rgbeData[i * 4] = 0;
      rgbeData[i * 4 + 1] = 0;
      rgbeData[i * 4 + 2] = 0;
      rgbeData[i * 4 + 3] = 0;
    } else {
      // Calculate exponent more precisely
      let exponent = Math.floor(Math.log2(max)) + 1;

      // Clamp exponent to valid range for RGBE
      exponent = Math.max(-128, Math.min(127, exponent));

      // Calculate mantissa scale
      const scale = Math.pow(2, -exponent) * 256.0;

      // Convert to 8-bit mantissa values
      const rMantissa = Math.min(255, Math.max(0, Math.floor(r * scale + 0.5)));
      const gMantissa = Math.min(255, Math.max(0, Math.floor(g * scale + 0.5)));
      const bMantissa = Math.min(255, Math.max(0, Math.floor(b * scale + 0.5)));

      // Store RGBE values
      rgbeData[i * 4] = rMantissa;
      rgbeData[i * 4 + 1] = gMantissa;
      rgbeData[i * 4 + 2] = bMantissa;
      rgbeData[i * 4 + 3] = exponent + 128; // Bias exponent by 128
    }
  }

  // Combine header and data
  const result = new Uint8Array(headerBytes.length + rgbeData.length);
  result.set(headerBytes, 0);
  result.set(rgbeData, headerBytes.length);

  return result;
}

interface WarpEffectProps {
  image: string;
  brushSize: number;
  brushStrength: number;
  zoom: number;
  onHistoryChange: (history: THREE.Texture[]) => void;
  history: THREE.Texture[];
  historyIndex: number;
  edgeSoftness?: number;
  onPointerMove?: (
    pos: { x: number; y: number; diameter: number } | null
  ) => void;
  panX: number;
  panY: number;
  onPanChange: (panX: number, panY: number) => void;
  onZoomChange: (zoom: number) => void;
  onExportReady?: (
    exportFn: (
      width: number,
      height: number,
      options?: { hdr?: boolean }
    ) => HTMLCanvasElement
  ) => void;
}

function WarpEffect({
  image,
  brushSize,
  brushStrength,
  zoom,
  onHistoryChange,
  history,
  historyIndex,
  onPointerMove,
  panX,
  panY,
  onPanChange,
  onZoomChange,
  onExportReady,
}: WarpEffectProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const { gl, viewport } = useThree();
  const texture = useTexture(image) as THREE.Texture;

  // Legacy shader path (kept for reference, not used)
  /*
  const shaderMaterial = useMemo(
    () => new THREE.ShaderMaterial({ ...WarpShader }),
    []
  );
  const shaderRef = useRef<THREE.ShaderMaterial>(shaderMaterial);
  const warpScene = useMemo(() => new THREE.Scene(), []);
  const warpQuad = useMemo(
    () => new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaderMaterial),
    [shaderMaterial]
  );
  */

  const [isWarping, setIsWarping] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [touchDistance, setTouchDistance] = useState(0);
  const mouse = useRef(new THREE.Vector2(0, 0));
  const prevMouse = useRef(new THREE.Vector2(0, 0));
  const panStart = useRef(new THREE.Vector2(0, 0));
  const initialPan = useRef(new THREE.Vector2(0, 0));
  const initialZoom = useRef(1);

  const displayMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  const displayMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({ ...DisplayShader });
    mat.uniforms.uTexture.value = texture;
    mat.userData._brush = BrushShader;
    return mat;
  }, [texture]);

  const brushMaterial = useMemo(
    () => new THREE.ShaderMaterial({ ...BrushShader }),
    []
  );
  const brushScene = useMemo(() => {
    const s = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), brushMaterial);
    s.add(quad);
    return s;
  }, [brushMaterial]);

  useEffect(() => {
    displayMaterialRef.current = displayMaterial;
  }, [displayMaterial]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Frame-buffers matching original image resolution
  const fbosRef = useRef<THREE.WebGLRenderTarget[]>([]);

  useEffect(() => {
    if (!texture.image) return;

    // Dispose old targets
    fbosRef.current.forEach((f) => f.dispose());

    // Clamp to GPU maximum
    const max = gl.capabilities.maxTextureSize;
    let w = (texture.image as HTMLImageElement).width;
    let h = (texture.image as HTMLImageElement).height;
    if (w > max || h > max) {
      const r = Math.min(max / w, max / h);
      w = Math.floor(w * r);
      h = Math.floor(h * r);
    }

    // Improve sampling quality by enabling anisotropic filtering
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy
      ? gl.capabilities.getMaxAnisotropy()
      : 0;

    // Create displacement FBOs for ping-pong rendering
    const fbo1 = new THREE.WebGLRenderTarget(w, h, DISP_RT_PARAMS);

    fbo1.texture.anisotropy = maxAnisotropy;

    const fbo2 = new THREE.WebGLRenderTarget(w, h, DISP_RT_PARAMS);

    fbo2.texture.anisotropy = maxAnisotropy;

    // Clear displacement to zero vector
    fbosRef.current = [fbo1, fbo2];
    fbosRef.current.forEach((rt) => {
      gl.setRenderTarget(rt);
      gl.clear();
    });
    gl.setRenderTarget(null);

    // Update texel size uniform
    // shaderRef.current.uniforms.uTexelSize.value.set(1 / w, 1 / h);

    currentFBOIndex.current = 0;

    // Set initial displacement uniform on display material
    if (displayMaterialRef.current) {
      displayMaterialRef.current.uniforms.uDisplacement.value =
        fbosRef.current[0].texture;
    }
  }, [texture, gl]);

  const currentFBOIndex = useRef(0);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const camera = useThree((state) => state.camera);
  const meshRef = useRef<THREE.Mesh>(null);

  // Update brushMaterial uniform when UI changes
  useEffect(() => {
    brushMaterial.uniforms.uBrushSize.value = brushSize / 200 / zoom;
    brushMaterial.uniforms.uBrushStrength.value = brushStrength / 100;
  }, [brushSize, brushStrength, zoom, brushMaterial]);

  // Restore texture from history when undo/redo is triggered
  useEffect(() => {
    if (history && history.length > 0 && historyIndex >= 0) {
      const displacementToRestore = history[historyIndex];
      const fbo = fbosRef.current[currentFBOIndex.current];

      const tempScene = new THREE.Scene();
      const tempQuad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ map: displacementToRestore })
      );
      tempScene.add(tempQuad);

      gl.setRenderTarget(fbo);
      gl.render(tempScene, camera);
      gl.setRenderTarget(null);

      // Update display material displacement uniform
      if (displayMaterialRef.current) {
        displayMaterialRef.current.uniforms.uDisplacement.value = fbo.texture;
      }
    }
  }, [history, historyIndex, fbosRef, gl, camera]);

  useEffect(() => {
    if (!texture) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    // Apply anisotropic filtering to the source texture as well
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy
      ? gl.capabilities.getMaxAnisotropy()
      : 0;
    texture.anisotropy = maxAnisotropy;

    texture.needsUpdate = true;
  }, [texture]);

  const scale = useMemo<[number, number, number]>(() => {
    if (!texture.image) return [1 * zoom, 1 * zoom, 1];
    const imageAspect =
      (texture.image as HTMLImageElement).width /
      (texture.image as HTMLImageElement).height;
    const screenAspect = viewport.width / viewport.height;
    if (imageAspect > screenAspect) {
      return [viewport.width * zoom, (viewport.width / imageAspect) * zoom, 1];
    }
    return [viewport.height * imageAspect * zoom, viewport.height * zoom, 1];
  }, [texture, viewport, zoom]);

  const position = useMemo<[number, number, number]>(() => {
    return [panX, panY, 0];
  }, [panX, panY]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (spacePressed) {
      setIsPanning(true);
      panStart.current.set(e.pointer.x, e.pointer.y);
      initialPan.current.set(panX, panY);
    } else if (!isPanning) {
      setIsWarping(true);
      prevMouse.current.copy(mouse.current);
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isPanning) {
      const deltaX = e.pointer.x - panStart.current.x;
      const deltaY = e.pointer.y - panStart.current.y;
      onPanChange(
        initialPan.current.x + deltaX * viewport.width * 0.5,
        initialPan.current.y + deltaY * viewport.height * 0.5
      );
    }
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
    } else if (isWarping) {
      setIsWarping(false);

      // For now, just ensure displacement persists (we'll add history back once this works)
      console.log("Warp ended, displacement should persist");
    }
  };

  const handleWheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation();
    const delta = e.deltaY;

    // Check if this is a pinch gesture (trackpad on macOS)
    if (e.nativeEvent.ctrlKey) {
      // Pinch zoom - more sensitive
      const zoomFactor = delta > 0 ? 0.95 : 1.05;
      const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));
      onZoomChange(newZoom);
    } else {
      // Regular scroll - slower zoom
      const zoomFactor = delta > 0 ? 0.97 : 1.03;
      const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));
      onZoomChange(newZoom);
    }
  };

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setIsPanning(true);
      const distance = getTouchDistance(e.touches);
      setTouchDistance(distance);
      initialZoom.current = zoom;

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const normalizedX = ((centerX - rect.left) / rect.width) * 2 - 1;
      const normalizedY = -((centerY - rect.top) / rect.height) * 2 + 1;

      panStart.current.set(normalizedX, normalizedY);
      initialPan.current.set(panX, panY);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && isPanning) {
      e.preventDefault();

      // Handle pinch zoom
      const distance = getTouchDistance(e.touches);
      if (touchDistance > 0) {
        const scale = distance / touchDistance;
        const newZoom = Math.max(0.1, Math.min(5, initialZoom.current * scale));
        onZoomChange(newZoom);
      }

      // Handle pan
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const normalizedX = ((centerX - rect.left) / rect.width) * 2 - 1;
      const normalizedY = -((centerY - rect.top) / rect.height) * 2 + 1;

      const deltaX = normalizedX - panStart.current.x;
      const deltaY = normalizedY - panStart.current.y;
      onPanChange(
        initialPan.current.x + deltaX * viewport.width * 0.5,
        initialPan.current.y + deltaY * viewport.height * 0.5
      );
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPanning(false);
      setTouchDistance(0);
    }
  };

  // Add touch event listeners
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    gl.domElement,
    isPanning,
    touchDistance,
    zoom,
    panX,
    panY,
    viewport,
    onZoomChange,
    onPanChange,
  ]);

  useFrame(({ pointer, size }) => {
    prevMouse.current.copy(mouse.current);
    mouse.current.set(pointer.x, pointer.y);

    if (!meshRef.current) return;

    raycaster.setFromCamera(new THREE.Vector2(pointer.x, pointer.y), camera);
    const intersects = raycaster.intersectObject(meshRef.current);
    const hit = intersects[0];

    if (onPointerMove && hit) {
      const worldPoint = hit.point.clone();
      const ndc = worldPoint.project(camera);
      const screenX = (ndc.x * 0.5 + 0.5) * size.width;
      const screenY = (ndc.y * -0.5 + 0.5) * size.height;
      const displayHeightPx = size.height * (scale[1] / viewport.height);
      const diameter = ((brushSize / 200) * displayHeightPx) / zoom;
      onPointerMove({ x: screenX, y: screenY, diameter });
    }

    if (isWarping && !isPanning && hit) {
      const currentDisp = fbosRef.current[currentFBOIndex.current];
      const nextDisp = fbosRef.current[(currentFBOIndex.current + 1) % 2];

      const currentUV = hit.uv!;

      raycaster.setFromCamera(
        new THREE.Vector2(prevMouse.current.x, prevMouse.current.y),
        camera
      );
      const prevHit = raycaster.intersectObject(meshRef.current)[0];
      const prevUV = prevHit ? prevHit.uv! : currentUV.clone();

      // Update brush uniforms
      brushMaterial.uniforms.uPrevDisp.value = currentDisp.texture;
      brushMaterial.uniforms.uMouse.value = new THREE.Vector2(
        currentUV.x,
        currentUV.y
      );
      brushMaterial.uniforms.uPrevMouse.value = new THREE.Vector2(
        prevUV.x,
        prevUV.y
      );
      brushMaterial.uniforms.uBrushSize.value = brushSize / 200.0;
      brushMaterial.uniforms.uBrushStrength.value = brushStrength / 100.0;
      brushMaterial.uniforms.uAspect.value = scale[0] / scale[1];

      // Render displacement update
      gl.setRenderTarget(nextDisp);
      gl.render(brushScene, camera);
      gl.setRenderTarget(null);

      // Update display material displacement uniform
      if (displayMaterialRef.current) {
        displayMaterialRef.current.uniforms.uDisplacement.value =
          nextDisp.texture;
      }

      currentFBOIndex.current = (currentFBOIndex.current + 1) % 2;
    }

    // Always ensure display material uses current displacement
    if (displayMaterialRef.current && fbosRef.current.length > 0) {
      displayMaterialRef.current.uniforms.uDisplacement.value =
        fbosRef.current[currentFBOIndex.current].texture;
    }
  });

  useEffect(() => {
    // If the texture is loaded and history is empty, push a true snapshot as the initial state
    if (texture && texture.image && history.length === 0) {
      // Create initial empty displacement snapshot
      const w = (texture.image as HTMLImageElement).width;
      const h = (texture.image as HTMLImageElement).height;
      const snapshotRT = new THREE.WebGLRenderTarget(w, h, DISP_RT_PARAMS);
      gl.setRenderTarget(snapshotRT);
      gl.clear(); // Clear to zero displacement
      gl.setRenderTarget(null);
      onHistoryChange([snapshotRT.texture]);

      // Mark component as initialized after texture is loaded and history is set
      console.log("WarpCanvas component initialized, setting export function");
      setIsInitialized(true);
    }
  }, [texture, history.length, onHistoryChange, gl, camera]);

  // Export function that renders at specified resolution
  const exportAtResolution = useCallback(
    (...args: unknown[]) => {
      // Prevent export calls during component initialization
      if (!isInitialized) {
        console.warn(
          "Export function called before component initialization, ignoring"
        );
        return document.createElement("canvas");
      }

      // Handle case where function might be called with an object or wrong parameters
      if (args.length === 1 && typeof args[0] === "object") {
        // Check if it's an empty object (common in React dev mode)
        if (args[0] && Object.keys(args[0]).length === 0) {
          console.warn(
            "Export function called with empty object, likely React dev mode issue. Ignoring."
          );
          return document.createElement("canvas");
        }
        // Check if it's a null object
        if (args[0] === null) {
          console.warn("Export function called with null, ignoring.");
          return document.createElement("canvas");
        }
        console.error(
          "Export function called with object instead of width/height:",
          {
            arg: args[0],
            stackTrace: new Error().stack,
          }
        );
        return document.createElement("canvas");
      }

      if (args.length < 2 || args.length > 3) {
        console.error(
          "Export function called with wrong number of arguments:",
          {
            args,
            argsLength: args.length,
            stackTrace: new Error().stack,
          }
        );
        return document.createElement("canvas");
      }

      const [width, height, options] = args as [
        number,
        number,
        { hdr?: boolean }?
      ];

      // Additional validation after type assertion
      if (typeof width !== "number" || typeof height !== "number") {
        console.error(
          "Export function called with non-number arguments after type assertion:",
          {
            width,
            height,
            widthType: typeof width,
            heightType: typeof height,
            stackTrace: new Error().stack,
          }
        );
        return document.createElement("canvas");
      }

      // Final validation - ensure we have positive finite numbers
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      ) {
        console.error("Export function called with invalid numeric values:", {
          width,
          height,
          widthFinite: Number.isFinite(width),
          heightFinite: Number.isFinite(height),
        });
        return document.createElement("canvas");
      }

      const isHDR = options?.hdr === true;

      // Validate dimensions
      if (!width || !height || width <= 0 || height <= 0) {
        console.error("Invalid export dimensions:", {
          width,
          height,
          widthIsNaN: isNaN(width),
          heightIsNaN: isNaN(height),
          widthIsFinite: isFinite(width),
          heightIsFinite: isFinite(height),
        });
        return document.createElement("canvas"); // Return empty canvas as fallback
      }

      if (!displayMaterial || !texture) {
        console.error("Display material or texture not ready for export");
        return document.createElement("canvas");
      }

      // Additional checks for texture readiness
      if (!texture.image) {
        console.error("Texture image not loaded yet");
        return document.createElement("canvas");
      }

      if (texture.image.width === 0 || texture.image.height === 0) {
        console.error("Texture has invalid dimensions:", {
          imageWidth: texture.image.width,
          imageHeight: texture.image.height,
        });
        return document.createElement("canvas");
      }

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      const exportCtx = exportCanvas.getContext("2d")!;

      // Create temporary render target at export resolution
      const exportRT = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: isHDR ? THREE.FloatType : THREE.UnsignedByteType,
        colorSpace: isHDR ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace,
      });

      // Create temporary scene with display material
      const exportScene = new THREE.Scene();
      const exportMaterial = displayMaterial.clone();

      if (isHDR) {
        // For HDR export, we need linear color values
        // First, remove any existing gamma correction
        if (exportMaterial.fragmentShader?.includes("pow(color.rgb")) {
          exportMaterial.fragmentShader = exportMaterial.fragmentShader.replace(
            /color\.rgb\s*=\s*pow\(color\.rgb,[^;]+;/,
            "// HDR: gamma correction removed for linear output"
          );
        }

        // Add sRGB to linear conversion since texture is in sRGB
        exportMaterial.fragmentShader = exportMaterial.fragmentShader.replace(
          /vec4 color = texture2D\(uTexture, uv\);/,
          `vec4 color = texture2D(uTexture, uv);
           // Convert sRGB to linear for HDR
           color.rgb = pow(color.rgb, vec3(2.2));`
        );

        exportMaterial.needsUpdate = true;
      } else {
        // For LDR export, remove gamma correction because the render target is in sRGB
        if (exportMaterial.fragmentShader?.includes("pow(color.rgb")) {
          exportMaterial.fragmentShader = exportMaterial.fragmentShader.replace(
            /color\.rgb\s*=\s*pow\(color\.rgb,[^;]+;/,
            "// LDR: gamma correction removed to avoid double encoding"
          );
          exportMaterial.needsUpdate = true;
        }
      }

      // Ensure the cloned material has the current displacement
      if (displayMaterialRef.current && fbosRef.current.length > 0) {
        exportMaterial.uniforms.uDisplacement.value =
          fbosRef.current[currentFBOIndex.current].texture;
      }
      const exportQuad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        exportMaterial
      );
      exportScene.add(exportQuad);

      const exportCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      // Render to export target
      gl.setRenderTarget(exportRT);
      gl.render(exportScene, exportCamera);
      gl.setRenderTarget(null);

      if (isHDR) {
        // For HDR export, read float data and create HDR file
        const floatPixels = new Float32Array(width * height * 4);
        gl.readRenderTargetPixels(exportRT, 0, 0, width, height, floatPixels);

        // Flip Y-axis for HDR data (OpenGL reads bottom-up, but HDR format expects top-down)
        const flippedFloatPixels = new Float32Array(width * height * 4);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const srcIdx = ((height - 1 - y) * width + x) * 4;
            const dstIdx = (y * width + x) * 4;
            flippedFloatPixels[dstIdx] = floatPixels[srcIdx]; // R
            flippedFloatPixels[dstIdx + 1] = floatPixels[srcIdx + 1]; // G
            flippedFloatPixels[dstIdx + 2] = floatPixels[srcIdx + 2]; // B
            flippedFloatPixels[dstIdx + 3] = floatPixels[srcIdx + 3]; // A
          }
        }

        // Create HDR data in Radiance (.hdr) format
        const hdrData = createHDRFile(flippedFloatPixels, width, height);

        // Create a downloadable blob
        const blob = new Blob([hdrData], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);

        // Trigger download
        const link = document.createElement("a");
        link.href = url;
        link.download = `warped_image_${width}x${height}.hdr`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Return a canvas indicating HDR was exported
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#00ff00";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("HDR File Downloaded", width / 2, height / 2 - 10);
        ctx.fillText(`${width}x${height}.hdr`, width / 2, height / 2 + 20);

        // Cleanup
        exportRT.dispose();
        return canvas;
      } else {
        // Standard LDR export
        const pixels = new Uint8Array(width * height * 4);
        gl.readRenderTargetPixels(exportRT, 0, 0, width, height, pixels);

        const imageData = new ImageData(
          new Uint8ClampedArray(pixels),
          width,
          height
        );
        exportCtx.putImageData(imageData, 0, 0);

        // Flip Y axis
        const flippedCanvas = document.createElement("canvas");
        flippedCanvas.width = width;
        flippedCanvas.height = height;
        const flippedCtx = flippedCanvas.getContext("2d")!;
        flippedCtx.scale(1, -1);
        flippedCtx.translate(0, -height);
        flippedCtx.drawImage(exportCanvas, 0, 0);

        // Cleanup
        exportRT.dispose();

        return flippedCanvas;
      }
    },
    [
      displayMaterial,
      gl,
      texture,
      displayMaterialRef,
      fbosRef,
      currentFBOIndex,
      isInitialized,
    ]
  );

  // Pass export function to parent
  useEffect(() => {
    console.log("Export function useEffect triggered:", {
      onExportReady: !!onExportReady,
      isInitialized,
      exportAtResolution: !!exportAtResolution,
    });
    if (onExportReady && isInitialized) {
      console.log("Passing export function to parent");
      onExportReady(exportAtResolution);
    }
  }, [onExportReady, exportAtResolution, isInitialized]);

  return (
    <mesh
      ref={meshRef}
      scale={scale}
      position={position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOut={() => {
        handlePointerUp();
        if (onPointerMove) onPointerMove(null);
      }}
      onWheel={handleWheel}
      material={displayMaterial}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

type WarpCanvasProps = WarpEffectProps;

const WarpCanvas = forwardRef<HTMLCanvasElement, WarpCanvasProps>(
  function WarpCanvas(
    {
      image,
      brushSize,
      brushStrength,
      zoom,
      onHistoryChange,
      history,
      historyIndex,
      onPointerMove,
      panX,
      panY,
      onPanChange,
      onZoomChange,
      onExportReady,
    },
    ref
  ) {
    return (
      <Canvas
        ref={ref as Ref<HTMLCanvasElement>}
        gl={{ preserveDrawingBuffer: true }}
      >
        <WarpEffect
          image={image}
          brushSize={brushSize}
          brushStrength={brushStrength}
          zoom={zoom}
          onHistoryChange={onHistoryChange}
          history={history}
          historyIndex={historyIndex}
          onPointerMove={onPointerMove}
          panX={panX}
          panY={panY}
          onPanChange={onPanChange}
          onZoomChange={onZoomChange}
          onExportReady={onExportReady}
        />
      </Canvas>
    );
  }
);

WarpCanvas.displayName = "WarpCanvas";

export default WarpCanvas;
