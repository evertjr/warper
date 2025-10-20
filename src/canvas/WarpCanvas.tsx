/* eslint-disable react-hooks/exhaustive-deps */
import { useTexture } from "@react-three/drei";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  forwardRef,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import type { HistoryItem } from "../context/WarperContext";
import { BrushShader } from "../shaders/brushShader";
import { DisplayShader } from "../shaders/displayShader";
import { createHDRFile } from "../utils/hdr";
import {
  cleanupHistory,
  disposeRenderTarget,
  getDisplacementRenderTargetParams,
  getHistoryRenderTargetParams,
  isMobileDevice,
  MAX_HISTORY_SIZE,
} from "../utils/webgl";

interface WarpEffectProps {
  image: string;
  brushSize: number;
  brushStrength: number;
  zoom: number;
  onHistoryChange: (history: HistoryItem[]) => void;
  history: HistoryItem[];
  historyIndex: number;
  onPointerMove?: (
    pos: { x: number; y: number; diameter: number } | null,
  ) => void;
  panX: number;
  panY: number;
  onPanChange: (panX: number, panY: number) => void;
  onZoomChange: (zoom: number) => void;
  onExportReady?: (
    exportFn: (
      width: number,
      height: number,
      options?: { hdr?: boolean },
    ) => HTMLCanvasElement,
  ) => void;
  isComparing?: boolean;
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
  isComparing,
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
  const [isTwoFingerGesture, setIsTwoFingerGesture] = useState(false);
  const [isDragStarted, setIsDragStarted] = useState(false);
  const [isWarpingDelayed, setIsWarpingDelayed] = useState(false);
  const lastBrushPreview = useRef<{
    x: number;
    y: number;
    diameter: number;
  } | null>(null);
  const mouse = useRef(new THREE.Vector2(0, 0));
  const prevMouse = useRef(new THREE.Vector2(0, 0));
  const panStart = useRef(new THREE.Vector2(0, 0));
  const initialPan = useRef(new THREE.Vector2(0, 0));
  const initialZoom = useRef(1);
  const prevHistoryIndex = useRef(-1);
  const justAddedHistory = useRef(false);
  const dragStartPos = useRef(new THREE.Vector2(0, 0));
  const warpDelayTimeout = useRef<number | null>(null);
  const DRAG_THRESHOLD = 5; // pixels
  const WARP_DELAY = 80; // milliseconds
  const MIN_ZOOM = 0.05;
  const activeTouchCount = useRef(0);

  const clearPreview = useCallback(() => {
    if (lastBrushPreview.current !== null && onPointerMove) {
      lastBrushPreview.current = null;
      onPointerMove(null);
    }
  }, [onPointerMove]);

  const displayMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  const displayMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({ ...DisplayShader });
    mat.uniforms.uTexture.value = texture;
    mat.userData._brush = BrushShader;
    return mat;
  }, [texture]);

  const brushMaterial = useMemo(
    () => new THREE.ShaderMaterial({ ...BrushShader }),
    [],
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

  const displacementRTParams = useMemo(
    () => getDisplacementRenderTargetParams(gl),
    [gl],
  );

  const historyRTParams = useMemo(() => getHistoryRenderTargetParams(gl), [gl]);

  const isMobile = useMemo(() => isMobileDevice(), []);

  useEffect(() => {
    const canvas = gl.domElement;
    const prevTouchAction = canvas.style.touchAction;
    const prevUserSelect = canvas.style.userSelect;
    const prevWebkitUserSelect = (canvas.style as any).webkitUserSelect;
    const prevMsUserSelect = (canvas.style as any).msUserSelect;
    const prevWebkitTouchCallout = (canvas.style as any).webkitTouchCallout;

    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    (canvas.style as any).webkitUserSelect = "none";
    (canvas.style as any).msUserSelect = "none";
    (canvas.style as any).webkitTouchCallout = "none";

    return () => {
      canvas.style.touchAction = prevTouchAction;
      canvas.style.userSelect = prevUserSelect;
      (canvas.style as any).webkitUserSelect = prevWebkitUserSelect;
      (canvas.style as any).msUserSelect = prevMsUserSelect;
      (canvas.style as any).webkitTouchCallout = prevWebkitTouchCallout;
    };
  }, [gl]);

  const historyLimit = useMemo(
    () =>
      isMobile ? Math.min(6, MAX_HISTORY_SIZE) : Math.min(20, MAX_HISTORY_SIZE),
    [isMobile],
  );

  const maxZoom = useMemo(() => (isMobile ? 24 : 48), [isMobile]);

  const clampZoom = useCallback(
    (value: number) => Math.max(MIN_ZOOM, Math.min(maxZoom, value)),
    [maxZoom],
  );

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
  const originalStateRef = useRef<THREE.Texture | null>(null); // Preserve original state

  useEffect(() => {
    if (!texture.image) return;

    // Dispose old targets properly
    fbosRef.current.forEach((f) => disposeRenderTarget(f));

    // Use full GPU capabilities - no mobile quality reduction
    const max = gl.capabilities.maxTextureSize;
    let w = (texture.image as HTMLImageElement).width;
    let h = (texture.image as HTMLImageElement).height;

    // Only clamp to GPU maximum, maintain quality
    if (w > max || h > max) {
      const r = Math.min(max / w, max / h);
      w = Math.floor(w * r);
      h = Math.floor(h * r);
    }

    // Use full anisotropic filtering for quality
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy
      ? gl.capabilities.getMaxAnisotropy()
      : 0;

    // Create displacement FBOs for ping-pong rendering - full quality
    const fbo1 = new THREE.WebGLRenderTarget(w, h, displacementRTParams);
    fbo1.texture.anisotropy = maxAnisotropy;

    const fbo2 = new THREE.WebGLRenderTarget(w, h, displacementRTParams);
    fbo2.texture.anisotropy = maxAnisotropy;

    // Clear displacement to zero vector
    fbosRef.current = [fbo1, fbo2];
    fbosRef.current.forEach((rt) => {
      gl.setRenderTarget(rt);
      gl.clear();
    });
    gl.setRenderTarget(null);

    currentFBOIndex.current = 0;

    // Create and store original state (empty displacement) - NEVER dispose this
    if (originalStateRef.current) {
      originalStateRef.current.dispose();
    }
    const originalRT = new THREE.WebGLRenderTarget(w, h, displacementRTParams);
    gl.setRenderTarget(originalRT);
    gl.clear();
    gl.setRenderTarget(null);
    originalStateRef.current = originalRT.texture;

    // Set initial displacement uniform on display material
    if (displayMaterialRef.current) {
      displayMaterialRef.current.uniforms.uDisplacement.value =
        fbosRef.current[0].texture;
    }

    // Force garbage collection on mobile (if available) - but maintain quality
    if (
      isMobile &&
      "gc" in window &&
      typeof (window as any).gc === "function"
    ) {
      setTimeout(() => (window as any).gc(), 100);
    }
  }, [texture, gl, displacementRTParams, isMobile]);

  const currentFBOIndex = useRef(0);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const camera = useThree((state) => state.camera);
  const meshRef = useRef<THREE.Mesh>(null);

  // Orthographic camera for full-screen quad rendering (FBO copies)
  const orthoCamera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    [],
  );

  // Update brushMaterial uniform when UI changes
  useEffect(() => {
    brushMaterial.uniforms.uBrushSize.value = brushSize / 200 / zoom;
    brushMaterial.uniforms.uBrushStrength.value = brushStrength / 100;
  }, [brushSize, brushStrength, zoom, brushMaterial]);

  // Function to restore to original state (empty displacement)
  const restoreToOriginal = useCallback(() => {
    if (originalStateRef.current && fbosRef.current.length > 0) {
      // Copy the original state into both FBOs
      fbosRef.current.forEach((targetFBO) => {
        const tempScene = new THREE.Scene();
        const tempQuad = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({ map: originalStateRef.current }),
        );
        tempScene.add(tempQuad);

        gl.setRenderTarget(targetFBO);
        gl.render(tempScene, orthoCamera);
        gl.setRenderTarget(null);

        // Clean up temporary objects immediately
        tempQuad.geometry.dispose();
        tempQuad.material.dispose();
      });

      // Update display material displacement uniform
      if (displayMaterialRef.current) {
        displayMaterialRef.current.uniforms.uDisplacement.value =
          fbosRef.current[currentFBOIndex.current].texture;
      }
    }
  }, [gl, orthoCamera]);

  // Function to restore displacement from history
  const restoreFromHistory = useCallback(
    (targetHistoryIndex: number) => {
      if (
        !history ||
        history.length === 0 ||
        targetHistoryIndex < 0 ||
        targetHistoryIndex >= history.length ||
        fbosRef.current.length === 0
      ) {
        return;
      }

      const snapshot = history[targetHistoryIndex];
      if (!snapshot) {
        restoreToOriginal();
        return;
      }

      const copyScene = new THREE.Scene();
      const copyQuad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({
          map: snapshot.target.texture,
        }),
      );
      copyScene.add(copyQuad);

      fbosRef.current.forEach((targetFBO) => {
        gl.setRenderTarget(targetFBO);
        gl.render(copyScene, orthoCamera);
        gl.setRenderTarget(null);
      });

      copyQuad.geometry.dispose();
      (copyQuad.material as THREE.Material).dispose();

      if (displayMaterialRef.current) {
        displayMaterialRef.current.uniforms.uDisplacement.value =
          fbosRef.current[currentFBOIndex.current].texture;
      }
    },
    [history, gl, orthoCamera, restoreToOriginal],
  );

  // Restore texture from history when historyIndex changes (undo/redo)
  useEffect(() => {
    // Skip restoration right after adding new history entry
    if (justAddedHistory.current) {
      justAddedHistory.current = false;
      prevHistoryIndex.current = historyIndex;
      return;
    }

    if (!isWarping && historyIndex !== prevHistoryIndex.current) {
      if (
        historyIndex >= 0 &&
        historyIndex < history.length &&
        history.length > 0
      ) {
        restoreFromHistory(historyIndex);
      } else if (historyIndex === -1) {
        // Fully reset to original image (no displacement)
        restoreToOriginal();
      }
    }

    prevHistoryIndex.current = historyIndex;
  }, [
    historyIndex,
    history.length,
    isWarping,
    restoreFromHistory,
    restoreToOriginal,
  ]);

  // Handle compare mode - show original vs current
  useEffect(() => {
    if (!isComparing) return;

    // When comparing is active, temporarily show original state
    if (originalStateRef.current && fbosRef.current.length > 0) {
      fbosRef.current.forEach((targetFBO) => {
        const tempScene = new THREE.Scene();
        const tempQuad = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({ map: originalStateRef.current }),
        );
        tempScene.add(tempQuad);

        gl.setRenderTarget(targetFBO);
        gl.render(tempScene, orthoCamera);
        gl.setRenderTarget(null);

        // Clean up temporary objects immediately
        tempQuad.geometry.dispose();
        tempQuad.material.dispose();
      });

      // Update display material
      if (displayMaterialRef.current) {
        displayMaterialRef.current.uniforms.uDisplacement.value =
          fbosRef.current[currentFBOIndex.current].texture;
      }
    }

    // Cleanup function to restore current state when compare is turned off
    return () => {
      if (
        history.length > 0 &&
        historyIndex >= 0 &&
        historyIndex < history.length
      ) {
        restoreFromHistory(historyIndex);
      }
    };
  }, [isComparing, gl, orthoCamera, history, historyIndex, restoreFromHistory]);

  useEffect(() => {
    if (!texture) return;
    console.log("Setting up texture color space:", {
      colorSpace: texture.colorSpace,
      format: texture.format,
      type: texture.type,
      flipY: texture.flipY,
    });
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
    console.log("Texture setup complete:", {
      colorSpace: texture.colorSpace,
      anisotropy: texture.anisotropy,
    });
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
    e.nativeEvent.preventDefault();
    e.stopPropagation();
    // Don't start warping if we're in a two-finger gesture or comparing
    if (isTwoFingerGesture || isComparing) return;

    if (e.pointerType === "touch") {
      activeTouchCount.current = Math.max(activeTouchCount.current, 1);
    }

    // Clear any existing timeout
    if (warpDelayTimeout.current) {
      clearTimeout(warpDelayTimeout.current);
      warpDelayTimeout.current = null;
    }

    if (spacePressed) {
      setIsPanning(true);
      panStart.current.set(e.pointer.x, e.pointer.y);
      initialPan.current.set(panX, panY);
    } else if (!isPanning) {
      // Store the initial touch position
      dragStartPos.current.set(e.pointer.x, e.pointer.y);
      setIsDragStarted(false);
      setIsWarpingDelayed(false);
      prevMouse.current.copy(mouse.current);

      // For desktop (mouse), start warping immediately on mouse down
      if (e.pointerType === "mouse") {
        setIsDragStarted(true);
        setIsWarping(true);
        setIsWarpingDelayed(true);
      }
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.nativeEvent.preventDefault();
    e.stopPropagation();
    if (isPanning && !isTwoFingerGesture) {
      const deltaX = e.pointer.x - panStart.current.x;
      const deltaY = e.pointer.y - panStart.current.y;
      onPanChange(
        initialPan.current.x + deltaX * viewport.width * 0.5,
        initialPan.current.y + deltaY * viewport.height * 0.5,
      );
    } else if (
      !isPanning &&
      !isTwoFingerGesture &&
      !spacePressed &&
      !isComparing &&
      e.pointerType !== "mouse"
    ) {
      // Only apply threshold and delay logic for touch events, not mouse
      if (!isDragStarted && !isWarping) {
        const currentPos = new THREE.Vector2(e.pointer.x, e.pointer.y);
        const distance = dragStartPos.current.distanceTo(currentPos);

        // Convert to screen pixels for threshold calculation
        const screenDistance =
          distance * Math.min(window.innerWidth, window.innerHeight) * 0.5;

        if (screenDistance > DRAG_THRESHOLD) {
          setIsDragStarted(true);

          // Start the delay timer before actually beginning to warp
          warpDelayTimeout.current = setTimeout(() => {
            setIsWarping(true);
            setIsWarpingDelayed(true);
            warpDelayTimeout.current = null;
          }, WARP_DELAY);
        }
      }
    }
  };

  const handlePointerUp = (e?: ThreeEvent<PointerEvent>) => {
    if (e) {
      e.nativeEvent.preventDefault();
      e.stopPropagation();
      if (e.pointerType === "touch") {
        activeTouchCount.current = 0;
      }
    }
    // Clear any pending warp delay
    if (warpDelayTimeout.current) {
      clearTimeout(warpDelayTimeout.current);
      warpDelayTimeout.current = null;
    }

    if (isPanning) {
      setIsPanning(false);
      clearPreview();
    } else if (
      (isWarping || isWarpingDelayed) &&
      !isTwoFingerGesture &&
      !isComparing &&
      isDragStarted
    ) {
      setIsWarping(false);
      setIsDragStarted(false);
      setIsWarpingDelayed(false);
      clearPreview();

      // Only save to history if we actually started warping (not just delayed)
      if (isWarpingDelayed && fbosRef.current.length > 0) {
        const currentDisp = fbosRef.current[currentFBOIndex.current];
        const w = currentDisp.width;
        const h = currentDisp.height;

        const maxPixels = isMobile ? 600_000 : 2_400_000;
        const totalPixels = w * h;
        const scale =
          totalPixels > maxPixels
            ? Math.sqrt(maxPixels / Math.max(1, totalPixels))
            : 1;
        const snapshotWidth = Math.max(64, Math.round(w * scale));
        const snapshotHeight = Math.max(64, Math.round(h * scale));

        // Create a snapshot of the current displacement with reduced resolution
        const snapshotRT = new THREE.WebGLRenderTarget(
          snapshotWidth,
          snapshotHeight,
          historyRTParams,
        );
        snapshotRT.texture.minFilter = THREE.LinearFilter;
        snapshotRT.texture.magFilter = THREE.LinearFilter;
        snapshotRT.texture.generateMipmaps = false;
        snapshotRT.texture.colorSpace = THREE.LinearSRGBColorSpace;

        const tempScene = new THREE.Scene();
        const tempQuad = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({ map: currentDisp.texture }),
        );
        tempScene.add(tempQuad);

        gl.setRenderTarget(snapshotRT);
        gl.render(tempScene, orthoCamera);
        gl.setRenderTarget(null);

        // Clean up temporary objects
        tempQuad.geometry.dispose();
        (tempQuad.material as THREE.Material).dispose();

        const preservedHistory = history.slice(0, historyIndex + 1);
        const discardedHistory = history.slice(historyIndex + 1);
        discardedHistory.forEach((item) => {
          if (item && item.target) disposeRenderTarget(item.target);
        });

        const historySnapshot: HistoryItem = {
          target: snapshotRT,
          width: snapshotWidth,
          height: snapshotHeight,
        };

        // Add to history with size management
        const currentHistory = [...preservedHistory, historySnapshot];
        const cleanedHistory = cleanupHistory(
          currentHistory,
          historyLimit,
          (item) => {
            if (item && item.target) disposeRenderTarget(item.target);
          },
        );
        onHistoryChange(cleanedHistory);

        // Mark that we just added history so the upcoming historyIndex change doesn't trigger restoration
        justAddedHistory.current = true;
      }
      clearPreview();
    } else {
      // Reset states if no drag occurred
      setIsWarping(false);
      setIsDragStarted(false);
      setIsWarpingDelayed(false);
    }
  };

  const handleWheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation();
    const delta = e.deltaY;

    // Check if this is a pinch gesture (trackpad on macOS)
    if (e.nativeEvent.ctrlKey) {
      // Pinch zoom - more sensitive
      const zoomFactor = delta > 0 ? 0.95 : 1.05;
      const newZoom = clampZoom(zoom * zoomFactor);
      onZoomChange(newZoom);
    } else {
      // Regular scroll - slower zoom
      const zoomFactor = delta > 0 ? 0.97 : 1.03;
      const newZoom = clampZoom(zoom * zoomFactor);
      onZoomChange(newZoom);
    }
  };

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2),
    );
  };

  const handleTouchStart = (e: TouchEvent) => {
    activeTouchCount.current = e.touches.length;
    if (e.touches.length === 2) {
      e.preventDefault();
      // Clear any pending warp delay
      if (warpDelayTimeout.current) {
        clearTimeout(warpDelayTimeout.current);
        warpDelayTimeout.current = null;
      }

      setIsTwoFingerGesture(true);
      setIsPanning(true);
      setIsWarping(false); // Stop any warping immediately
      setIsDragStarted(false); // Reset drag state
      setIsWarpingDelayed(false);

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
    } else if (e.touches.length === 1) {
      setIsTwoFingerGesture(false);
      // Reset drag states for single touch
      setIsDragStarted(false);
      setIsWarping(false);
      setIsWarpingDelayed(false);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    activeTouchCount.current = e.touches.length;
    if (e.touches.length === 2 && isPanning && isTwoFingerGesture) {
      e.preventDefault();

      // Handle pinch zoom
      const distance = getTouchDistance(e.touches);
      if (touchDistance > 0) {
        const scale = distance / touchDistance;
        const newZoom = clampZoom(initialZoom.current * scale);
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
        initialPan.current.y + deltaY * viewport.height * 0.5,
      );
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    activeTouchCount.current = e.touches.length;
    if (e.touches.length < 2) {
      // Clear any pending warp delay
      if (warpDelayTimeout.current) {
        clearTimeout(warpDelayTimeout.current);
        warpDelayTimeout.current = null;
      }

      setIsPanning(false);
      setTouchDistance(0);
      setIsTwoFingerGesture(false);

      // Reset drag states when touch ends
      if (e.touches.length === 0) {
        setIsDragStarted(false);
        setIsWarping(false);
        setIsWarpingDelayed(false);
        clearPreview();
      }
    }
  };

  const handleTouchCancel = (e: TouchEvent) => {
    if (warpDelayTimeout.current) {
      clearTimeout(warpDelayTimeout.current);
      warpDelayTimeout.current = null;
    }
    activeTouchCount.current = 0;
    setIsPanning(false);
    setTouchDistance(0);
    setIsTwoFingerGesture(false);
    setIsDragStarted(false);
    setIsWarping(false);
    setIsWarpingDelayed(false);
    clearPreview();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (warpDelayTimeout.current) {
        clearTimeout(warpDelayTimeout.current);
      }

      // Cleanup WebGL resources on unmount
      fbosRef.current.forEach((f) => disposeRenderTarget(f));
      fbosRef.current = [];

      // Dispose original state on unmount
      if (originalStateRef.current) {
        originalStateRef.current.dispose();
        originalStateRef.current = null;
      }

      // Clear brush preview reference
      lastBrushPreview.current = null;

      // Force garbage collection on mobile (if available)
      if (
        isMobile &&
        "gc" in window &&
        typeof (window as any).gc === "function"
      ) {
        setTimeout(() => (window as any).gc(), 100);
      }
    };
  }, [isMobile]);

  // Add touch event listeners
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", handleTouchCancel, {
      passive: false,
    });

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchCancel);
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
    isTwoFingerGesture,
    isDragStarted,
    isWarping,
    isWarpingDelayed,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  ]);

  useFrame(({ pointer, size }) => {
    prevMouse.current.copy(mouse.current);
    mouse.current.set(pointer.x, pointer.y);

    if (!meshRef.current) return;

    raycaster.setFromCamera(new THREE.Vector2(pointer.x, pointer.y), camera);
    const intersects = raycaster.intersectObject(meshRef.current);
    const hit = intersects[0];

    const shouldShowPreview =
      onPointerMove &&
      hit &&
      !isTwoFingerGesture &&
      (!isMobile || activeTouchCount.current > 0);

    if (shouldShowPreview) {
      const worldPoint = hit.point.clone();
      const ndc = worldPoint.project(camera);
      const screenX = (ndc.x * 0.5 + 0.5) * size.width;
      const screenY = (ndc.y * -0.5 + 0.5) * size.height;
      const displayHeightPx = size.height * (scale[1] / viewport.height);
      const diameter = ((brushSize / 200) * displayHeightPx) / zoom;

      // Only update if position changed significantly (reduce re-renders)
      const newPreview = { x: screenX, y: screenY, diameter };
      const lastPreview = lastBrushPreview.current;

      if (
        !lastPreview ||
        Math.abs(newPreview.x - lastPreview.x) > 2 ||
        Math.abs(newPreview.y - lastPreview.y) > 2 ||
        Math.abs(newPreview.diameter - lastPreview.diameter) > 1
      ) {
        lastBrushPreview.current = newPreview;
        onPointerMove(newPreview);
      }
    } else if (onPointerMove && lastBrushPreview.current !== null) {
      clearPreview();
    }

    // Only apply warping if drag has started, delay has completed, and we're actually warping
    if (
      isWarping &&
      isWarpingDelayed &&
      !isPanning &&
      !isTwoFingerGesture &&
      !isComparing &&
      isDragStarted &&
      hit
    ) {
      const currentDisp = fbosRef.current[currentFBOIndex.current];
      const nextDisp = fbosRef.current[(currentFBOIndex.current + 1) % 2];

      const currentUV = hit.uv!;

      raycaster.setFromCamera(
        new THREE.Vector2(prevMouse.current.x, prevMouse.current.y),
        camera,
      );
      const prevHit = raycaster.intersectObject(meshRef.current)[0];
      const prevUV = prevHit ? prevHit.uv! : currentUV.clone();

      // Update brush uniforms
      brushMaterial.uniforms.uPrevDisp.value = currentDisp.texture;
      brushMaterial.uniforms.uMouse.value = new THREE.Vector2(
        currentUV.x,
        currentUV.y,
      );
      brushMaterial.uniforms.uPrevMouse.value = new THREE.Vector2(
        prevUV.x,
        prevUV.y,
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
    // If the texture is loaded and history is empty, push the original state as the initial state
    if (
      texture &&
      texture.image &&
      history.length === 0 &&
      originalStateRef.current
    ) {
      onHistoryChange([null]);

      // Mark component as initialized after texture is loaded and history is set
      console.log("WarpCanvas component initialized, setting export function");
      setIsInitialized(true);
    }
  }, [texture, history.length, onHistoryChange]);

  // Export function that renders at specified resolution
  const exportAtResolution = useCallback(
    (...args: unknown[]) => {
      // Prevent export calls during component initialization
      if (!isInitialized) {
        console.warn(
          "Export function called before component initialization, ignoring",
        );
        return document.createElement("canvas");
      }

      // Handle case where function might be called with an object or wrong parameters
      if (args.length === 1 && typeof args[0] === "object") {
        // Check if it's an empty object (common in React dev mode)
        if (args[0] && Object.keys(args[0]).length === 0) {
          console.warn(
            "Export function called with empty object, likely React dev mode issue. Ignoring.",
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
          },
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
          },
        );
        return document.createElement("canvas");
      }

      const [width, height, options] = args as [
        number,
        number,
        { hdr?: boolean }?,
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
          },
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
        // Use sRGB color space for standard export so renderer performs gamma encoding
        colorSpace: isHDR ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace,
      });

      // Create temporary scene with display material
      const exportScene = new THREE.Scene();
      const exportMaterial = displayMaterial.clone();

      if (isHDR) {
        // For HDR export, strip all display adjustments and get raw linear data
        exportMaterial.fragmentShader = `
          uniform sampler2D uTexture;
          uniform sampler2D uDisplacement;
          varying vec2 vUv;
          
          void main() {
            vec2 disp = texture2D(uDisplacement, vUv).rg;
            vec2 sampleUv = vUv - disp;
            // Get raw linear color data without any tone-mapping
            vec3 color = texture2D(uTexture, sampleUv).rgb;
            gl_FragColor = vec4(color, 1.0);
          }
        `;
        exportMaterial.needsUpdate = true;
      }

      // Ensure the cloned material has the current displacement
      if (displayMaterialRef.current && fbosRef.current.length > 0) {
        exportMaterial.uniforms.uDisplacement.value =
          fbosRef.current[currentFBOIndex.current].texture;
      }
      const exportQuad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        exportMaterial,
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
          height,
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
    ],
  );

  const exportFnSent = useRef(false);

  // Pass export function to parent
  useEffect(() => {
    if (!exportFnSent.current && onExportReady && isInitialized) {
      onExportReady(exportAtResolution);
      exportFnSent.current = true;
    }
  }, [onExportReady, isInitialized, exportAtResolution]);

  return (
    <mesh
      ref={meshRef}
      scale={scale}
      position={position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOut={() => {
        // Clear any pending warp delay
        if (warpDelayTimeout.current) {
          clearTimeout(warpDelayTimeout.current);
          warpDelayTimeout.current = null;
        }

        // Clear brush preview reference
        lastBrushPreview.current = null;

        handlePointerUp();
        setIsDragStarted(false);
        setIsWarping(false);
        setIsWarpingDelayed(false);
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

export const WarpCanvas = forwardRef<HTMLCanvasElement, WarpCanvasProps>(
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
      isComparing,
    },
    ref,
  ) {
    return (
      <Canvas
        ref={ref as Ref<HTMLCanvasElement>}
        gl={{
          preserveDrawingBuffer: true,
        }}
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
          isComparing={isComparing}
        />
      </Canvas>
    );
  },
);
