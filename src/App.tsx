"use client";

import {
  Brush,
  Redo2,
  RotateCcw,
  SquareSplitHorizontal,
  Undo2,
  Upload,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Menu,
  MenuItem,
  MenuTrigger,
  OverlayArrow,
  Popover,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import * as THREE from "three";
import { WarpCanvas } from "./canvas/WarpCanvas";
import { InstallPrompt } from "./components/InstallPrompt";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  downloadCanvasWithExif,
  extractExifData,
  type ExifData,
} from "./utils/exif";

export type HistoryItem = THREE.Texture;

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(50);
  const [brushStrength, setBrushStrength] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [brushPreview, setBrushPreview] = useState<{
    x: number;
    y: number;
    diameter: number;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImageData, setOriginalImageData] = useState<{
    width: number;
    height: number;
    format: string;
  } | null>(null);
  const [exportFunction, setExportFunction] = useState<
    | ((
        width: number,
        height: number,
        options?: { hdr?: boolean },
      ) => HTMLCanvasElement)
    | null
  >(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HistoryItem[]>([]);
  const historyIndexRef = useRef(-1);
  const [isComparing, setIsComparing] = useState(false);
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [hasWideGamutProfile, setHasWideGamutProfile] = useState(false);

  // Update refs when state changes
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Prevent page zoom on mobile
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventKeyboardZoom = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "+" || e.key === "-" || e.key === "0")
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchstart", preventZoom, { passive: false });
    document.addEventListener("touchmove", preventZoom, { passive: false });
    document.addEventListener("keydown", preventKeyboardZoom);

    return () => {
      document.removeEventListener("touchstart", preventZoom);
      document.removeEventListener("touchmove", preventZoom);
      document.removeEventListener("keydown", preventKeyboardZoom);
    };
  }, []);

  // Debug when export function changes
  useEffect(() => {
    console.log("Export function updated:", {
      hasFunction: !!exportFunction,
      type: typeof exportFunction,
      isFunction: typeof exportFunction === "function",
    });
  }, [exportFunction]);

  // Update image loaded state when original image data changes
  useEffect(() => {
    setIsImageLoaded(
      !!originalImageData &&
        originalImageData.width > 0 &&
        originalImageData.height > 0,
    );
  }, [originalImageData]);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!event.target.files || !event.target.files[0]) return;

    const file = event.target.files[0];
    setOriginalFile(file);

    // Extract EXIF data from the original file (before any conversion)
    const extractedExifData = await extractExifData(file);
    setExifData(extractedExifData);

    // Check if image has a wide gamut color profile
    const hasIccProfile = !!(
      extractedExifData?.iccProfile &&
      extractedExifData.iccProfile.byteLength > 0
    );
    const colorSpace = extractedExifData?.ColorSpace;
    const whitePoint = extractedExifData?.WhitePoint;
    const colorSpaceData = extractedExifData?.ColorSpaceData;

    console.log("Color space analysis:", {
      hasIccProfile,
      colorSpace,
      whitePoint,
      colorSpaceData,
      iccProfileSize: extractedExifData?.iccProfile?.byteLength || 0,
    });

    // Detect wide gamut profiles
    const isWideGamut =
      hasIccProfile ||
      colorSpace === "Adobe RGB" ||
      colorSpace === "ProPhoto RGB" ||
      colorSpace === 65535; // Uncalibrated color space often indicates wide gamut

    setHasWideGamutProfile(isWideGamut);
    console.log("Wide gamut detection result:", isWideGamut);

    const isHeif =
      /heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name);

    try {
      let blob: Blob;
      if (isHeif) {
        // Dynamically import to avoid increasing bundle for browsers that don't load HEIF
        const heic2any = (await import("heic2any")).default;
        blob = (await heic2any({ blob: file, toType: "image/png" })) as Blob;
      } else {
        blob = file;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === "string") {
          // Load image through 2D canvas to ensure proper color profile handling
          const img = new Image();
          img.onload = () => {
            // Create a canvas to apply color profile conversion
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", {
              colorSpace: "srgb", // Ensure sRGB output
            });

            if (!ctx) {
              console.warn("Failed to create 2D context, using original image");
              setImage(e.target?.result as string);
              return;
            }

            canvas.width = img.width;
            canvas.height = img.height;

            // Draw image - browser will handle ICC profile conversion to sRGB
            ctx.drawImage(img, 0, 0);

            // Convert back to data URL in sRGB color space
            const srgbDataUrl = canvas.toDataURL("image/png", 1.0);
            setImage(srgbDataUrl);

            console.log("Image converted to sRGB color space for WebGL");

            // Get original image dimensions
            setOriginalImageData({
              width: img.width,
              height: img.height,
              format: file.type || "image/png",
            });
          };

          img.onerror = () => {
            console.warn(
              "Failed to load image for color conversion, using original",
            );
            setImage(e.target?.result as string);

            // Fallback: Get dimensions from original image
            const fallbackImg = new Image();
            fallbackImg.onload = () => {
              setOriginalImageData({
                width: fallbackImg.width,
                height: fallbackImg.height,
                format: file.type || "image/png",
              });
            };
            fallbackImg.src = e.target?.result as string;
          };

          img.src = e.target?.result as string;

          // Reset state when loading new image
          setHistory([]);
          setHistoryIndex(-1);
          setPanX(0);
          setPanY(0);
          setZoom(1);
          setExportFunction(null);
          setIsImageLoaded(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Failed to load image", error);
      alert("Unable to load this image format.");
    }
  };

  const handleLoadNewImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleExportInternal = async (hdr = false) => {
    console.log("handleExport called, exportFunction:", {
      exportFunction,
      type: typeof exportFunction,
      isFunction: typeof exportFunction === "function",
      hdr,
    });

    if (!exportFunction || !originalImageData || !isImageLoaded) {
      console.error("Export not ready:", {
        exportFunction: !!exportFunction,
        originalImageData,
        isImageLoaded,
      });
      alert(
        "Export not ready. Please wait for the image to load completely and try again.",
      );
      return;
    }

    if (!originalImageData.width || !originalImageData.height) {
      console.error("Invalid image dimensions:", originalImageData);
      alert("Invalid image dimensions. Please reload the image.");
      return;
    }

    if (typeof exportFunction !== "function") {
      console.error("exportFunction is not a function:", {
        exportFunction,
        type: typeof exportFunction,
      });
      alert("Export function is not ready. Please try reloading the page.");
      return;
    }

    // Get the warped result at original resolution
    const { width, height } = originalImageData;
    const exportCanvas = exportFunction(width, height, { hdr });

    if (hdr) {
      // HDR export is handled inside the export function (downloads automatically)
      return;
    }

    if (
      !exportCanvas ||
      exportCanvas.width === 0 ||
      exportCanvas.height === 0
    ) {
      console.error("Export failed to generate valid canvas");
      alert("Export failed. Please try again.");
      return;
    }

    // Generate filename based on original file
    let filename = "warped-image";
    let mimeType = "image/jpeg"; // Default to JPEG for best compatibility
    let quality = 0.95;
    let extension = "jpg";

    if (originalFile) {
      // Extract filename without extension
      const originalName = originalFile.name.replace(/\.[^/.]+$/, "");
      filename = `${originalName}-edit`;

      // Determine format - prefer JPEG for most cases, PNG for transparency
      const fileType = originalFile.type.toLowerCase();
      if (fileType.includes("png")) {
        mimeType = "image/png";
        quality = 1.0;
        extension = "png";
      } else if (fileType.includes("webp")) {
        mimeType = "image/webp";
        quality = 0.95;
        extension = "webp";
      } else {
        // Default to JPEG for all other formats (including HEIF/HEIC)
        // JPEG provides the best balance of quality and file size
        mimeType = "image/jpeg";
        quality = 0.95;
        extension = "jpg";
      }
    }

    try {
      // Use the new EXIF-preserving export function
      await downloadCanvasWithExif(
        exportCanvas,
        `${filename}.${extension}`,
        mimeType,
        quality,
        exifData,
      );
    } catch (error) {
      console.error("Export failed:", error);
      alert(
        "Export failed. The image may be too large or the format unsupported.",
      );
    }
  };

  const handleExport = async () => await handleExportInternal(false);
  const handleExportHDR = async () => await handleExportInternal(true);

  const handleUndo = useCallback(() => {
    setHistoryIndex((idx) => {
      if (idx > 0) {
        return idx - 1;
      }
      return idx;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryIndex((idx) => {
      const currentHistoryLength = historyRef.current.length;
      if (idx < currentHistoryLength - 1) {
        return idx + 1;
      }
      return idx;
    });
  }, []);

  const onHistoryChange = useCallback((newHistory: HistoryItem[]) => {
    // Use consistent history size - no mobile reduction for quality
    const maxHistorySize = 15;

    if (newHistory.length > maxHistorySize) {
      // Dispose old textures before removing them (except first item which is original state)
      const toDispose = newHistory.slice(
        1,
        newHistory.length - maxHistorySize + 1,
      );
      toDispose.forEach((texture) => {
        if (texture && texture.dispose) {
          texture.dispose();
        }
      });

      // Keep original state (first item) + recent history
      const trimmedHistory = [
        newHistory[0],
        ...newHistory.slice(newHistory.length - maxHistorySize + 1),
      ];
      setHistory(trimmedHistory);
      setHistoryIndex(trimmedHistory.length - 1);
    } else {
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, []);

  const handleRestoreAll = useCallback(() => {
    // Always restore to first item in history (original state)
    if (history.length > 0) {
      setHistoryIndex(0);
    }
  }, [history.length]);

  const handlePanChange = useCallback((newPanX: number, newPanY: number) => {
    setPanX(newPanX);
    setPanY(newPanY);
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const handleResetView = useCallback(() => {
    setPanX(0);
    setPanY(0);
    setZoom(1);
  }, []);

  const handleCompareToggle = useCallback(() => {
    setIsComparing((prev) => !prev);
  }, []);

  // Use keyboard shortcuts hook
  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    brushSize,
    onBrushSizeChange: setBrushSize,
    zoom,
    onZoomChange: handleZoomChange,
  });

  // Memoize brush preview to prevent unnecessary re-renders
  const brushPreviewComponent = useMemo(() => {
    if (!brushPreview) return null;

    return (
      <div
        style={{
          position: "absolute",
          left: brushPreview.x - brushPreview.diameter / 2,
          top: brushPreview.y - brushPreview.diameter / 2,
          width: brushPreview.diameter,
          height: brushPreview.diameter,
          border: "1px solid white",
          borderRadius: "50%",
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      />
    );
  }, [brushPreview]);

  return (
    <div
      className="relative bg-[#0E0E0E] w-screen h-svh touch-none select-none"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <InstallPrompt />
      <OfflineIndicator />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {image ? (
        <>
          <WarpCanvas
            ref={canvasRef}
            image={image as string}
            brushSize={brushSize}
            brushStrength={brushStrength}
            zoom={zoom}
            onHistoryChange={onHistoryChange}
            history={history}
            historyIndex={historyIndex}
            onPointerMove={setBrushPreview}
            panX={panX}
            panY={panY}
            onPanChange={handlePanChange}
            onZoomChange={handleZoomChange}
            onExportReady={(fn) => setExportFunction(() => fn)}
            isComparing={isComparing}
          />
          {brushPreviewComponent}

          {/* Professional Metadata Overlay */}
          {originalImageData && (
            <div className="absolute top-4 left-4 text-xs text-white/80 font-mono leading-relaxed pointer-events-none select-none">
              <div className="bg-black/20 backdrop-blur-sm rounded px-2 py-1">
                <div>
                  {originalImageData.width} × {originalImageData.height}
                </div>
                {hasWideGamutProfile && (
                  <div className="text-yellow-300/90">
                    {exifData?.ColorSpace === 65535
                      ? "Wide Gamut"
                      : exifData?.ColorSpace === "Adobe RGB"
                        ? "Adobe RGB"
                        : exifData?.ColorSpace === "ProPhoto RGB"
                          ? "ProPhoto RGB"
                          : "Wide Gamut"}
                  </div>
                )}
                {!hasWideGamutProfile && (
                  <div className="text-green-300/90">sRGB</div>
                )}
                {originalFile && (
                  <div className="text-white/60">
                    {(originalFile.size / 1024 / 1024).toFixed(1)}MB
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom toolbar */}
          <div
            className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full pl-4 pr-2 py-2 shadow-lg border border-gray-200 select-none"
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
              MozUserSelect: "none",
              msUserSelect: "none",
              WebkitTouchCallout: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <Button
              onPress={handleLoadNewImage}
              className="p-2 hover:bg-gray-100 focus:bg-gray-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Load new image"
            >
              <Upload size={18} className="text-gray-800" />
            </Button>
            <div className="w-px h-6 bg-gray-300" />
            <Button
              onPress={handleUndo}
              isDisabled={historyIndex <= 0}
              className="p-2 hover:bg-gray-100 focus:bg-gray-200 disabled:opacity-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:focus:ring-0"
              aria-label="Undo (Cmd/Ctrl+Z)"
            >
              <Undo2 size={18} className="text-gray-800" />
            </Button>
            <Button
              onPress={handleRedo}
              isDisabled={historyIndex >= history.length - 1}
              className="p-2 hover:bg-gray-100 focus:bg-gray-200 disabled:opacity-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:focus:ring-0"
              aria-label="Redo (Cmd/Ctrl+Shift+Z)"
            >
              <Redo2 size={18} className="text-gray-800" />
            </Button>
            <Button
              onPress={handleRestoreAll}
              isDisabled={historyIndex <= 0}
              className="p-2 hover:bg-gray-100 focus:bg-gray-200 disabled:opacity-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:focus:ring-0"
              aria-label="Restore to original"
            >
              <RotateCcw size={18} className="text-gray-800" />
            </Button>
            <Button
              onPress={handleCompareToggle}
              isDisabled={historyIndex <= 0}
              className={`p-2 hover:bg-gray-100 focus:bg-gray-200 disabled:opacity-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:focus:ring-0 ${
                isComparing ? "bg-blue-100 text-blue-700" : "text-gray-800"
              }`}
              aria-label="Compare with original"
            >
              <SquareSplitHorizontal size={18} />
            </Button>
            <Button
              onPress={handleResetView}
              className="p-2 hover:bg-gray-100 focus:bg-gray-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Reset view"
            >
              <ZoomOut size={18} className="text-gray-800" />
            </Button>
            <div className="w-px h-6 bg-gray-300" />
            <MenuTrigger>
              <Button
                isDisabled={!exportFunction || !isImageLoaded}
                className="px-3 py-2 bg-black hover:bg-gray-800 focus:bg-gray-900 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Export options"
              >
                <span className="text-sm font-medium">Export</span>
              </Button>
              <Popover className="bg-white border border-gray-200 rounded-md shadow-lg min-w-[160px] z-50 data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95">
                <Menu className="outline-none p-1">
                  <MenuItem
                    onAction={handleExport}
                    className="px-3 py-2 text-sm hover:bg-gray-50 focus:bg-gray-50 cursor-pointer outline-none rounded-sm text-gray-700 focus:outline-none"
                  >
                    Export Standard
                  </MenuItem>
                  <MenuItem
                    onAction={handleExportHDR}
                    className="px-3 py-2 text-sm hover:bg-gray-50 focus:bg-gray-50 cursor-pointer outline-none rounded-sm text-gray-700 focus:outline-none"
                  >
                    Export HDR (.hdr)
                  </MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
          </div>

          {/* Settings Popover - Top Right */}
          <div
            className="absolute top-6 right-6 select-none"
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
              MozUserSelect: "none",
              msUserSelect: "none",
              WebkitTouchCallout: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <DialogTrigger>
              <Button
                className="p-3 bg-white/90 backdrop-blur-sm hover:bg-white focus:bg-white rounded-full shadow-lg border border-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Brush settings"
              >
                <Brush size={20} className="text-gray-700" />
              </Button>
              <Popover className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-64 z-50 data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95">
                <OverlayArrow>
                  <svg
                    width={12}
                    height={12}
                    viewBox="0 0 12 12"
                    className="block fill-white stroke-gray-200 stroke-1 drop-shadow-md"
                  >
                    <path d="M0 0 L6 6 L12 0" />
                  </svg>
                </OverlayArrow>
                <Dialog className="outline-none">
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-gray-900 mb-4">
                        Brush Settings
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Slider
                          value={brushSize}
                          onChange={setBrushSize}
                          minValue={1}
                          maxValue={200}
                          className="flex flex-col gap-2"
                          aria-label="Brush size"
                        >
                          <div className="flex justify-between text-sm">
                            <label className="font-medium text-gray-700">
                              Size <span className="text-gray-500">[ ]</span>
                            </label>
                            <SliderOutput className="text-gray-500 font-mono">
                              {({ state }) => `${state.getThumbValue(0)}`}
                            </SliderOutput>
                          </div>
                          <SliderTrack className="relative w-full h-2 bg-gray-200 rounded-lg">
                            <SliderThumb className="w-4 h-4 mt-1 bg-white border-2 border-gray-400 rounded-full focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dragging:bg-gray-50 transition-colors" />
                          </SliderTrack>
                        </Slider>
                      </div>

                      <div>
                        <Slider
                          value={brushStrength}
                          onChange={setBrushStrength}
                          minValue={1}
                          maxValue={100}
                          className="flex flex-col gap-2"
                          aria-label="Brush strength"
                        >
                          <div className="flex justify-between text-sm">
                            <label className="font-medium text-gray-700">
                              Strength
                            </label>
                            <SliderOutput className="text-gray-500 font-mono">
                              {({ state }) => `${state.getThumbValue(0)}`}
                            </SliderOutput>
                          </div>
                          <SliderTrack className="relative w-full h-2 bg-gray-200 rounded-lg">
                            <SliderThumb className="w-4 h-4 mt-1 bg-white border-2 border-gray-400 rounded-full focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dragging:bg-gray-50 transition-colors" />
                          </SliderTrack>
                        </Slider>
                      </div>

                      <div>
                        <Slider
                          value={zoom}
                          onChange={setZoom}
                          minValue={1}
                          maxValue={5}
                          step={0.1}
                          className="flex flex-col gap-2"
                          aria-label="Zoom level"
                        >
                          <div className="flex justify-between text-sm">
                            <label className="font-medium text-gray-700">
                              Zoom <span className="text-gray-500">+ -</span>
                            </label>
                            <SliderOutput className="text-gray-500 font-mono">
                              {({ state }) =>
                                `${Math.round(state.getThumbValue(0) * 100)}%`
                              }
                            </SliderOutput>
                          </div>
                          <SliderTrack className="relative w-full h-2 bg-gray-200 rounded-lg">
                            <SliderThumb className="w-4 h-4 mt-1 bg-white border-2 border-gray-400 rounded-full focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dragging:bg-gray-50 transition-colors" />
                          </SliderTrack>
                        </Slider>
                      </div>
                    </div>
                  </div>
                </Dialog>
              </Popover>
            </DialogTrigger>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <h1 className="text-5xl font-light text-gray-900 mb-2">Warper</h1>
            <p className="text-gray-600 mb-8">
              Transform your images with precision
            </p>
            <Button
              onPress={handleLoadNewImage}
              className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 focus:bg-gray-100 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span className="text-gray-700 font-medium">Choose Image</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
