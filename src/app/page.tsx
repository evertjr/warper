"use client";

import {
  ChevronDown,
  Download,
  Redo2,
  RotateCcw,
  Sliders,
  Undo2,
  Upload,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import WarpCanvas from "./WarpCanvas";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export type HistoryItem = THREE.Texture;

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(50);
  const [brushStrength, setBrushStrength] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [edgeSoftness, setEdgeSoftness] = useState(0);
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
        options?: { hdr?: boolean }
      ) => HTMLCanvasElement)
    | null
  >(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        originalImageData.height > 0
    );
  }, [originalImageData]);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files || !event.target.files[0]) return;

    const file = event.target.files[0];
    setOriginalFile(file);

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
          setImage(e.target.result);
          // Reset state when loading new image
          setHistory([]);
          setHistoryIndex(-1);
          setPanX(0);
          setPanY(0);
          setZoom(1);
          setExportFunction(null);
          setIsImageLoaded(false);

          // Get original image dimensions
          const img = new Image();
          img.onload = () => {
            setOriginalImageData({
              width: img.width,
              height: img.height,
              format: file.type || "image/png",
            });
          };
          img.src = e.target.result;
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

  const handleExportInternal = (hdr = false) => {
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
        "Export not ready. Please wait for the image to load completely and try again."
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
      const link = document.createElement("a");
      link.download = `${filename}.${extension}`;
      link.href = exportCanvas.toDataURL(mimeType, quality);
      link.click();
    } catch (error) {
      console.error("Export failed:", error);
      alert(
        "Export failed. The image may be too large or the format unsupported."
      );
    }
  };

  const handleExport = () => handleExportInternal(false);
  const handleExportHDR = () => handleExportInternal(true);

  const handleUndo = useCallback(() => {
    setHistoryIndex((idx) => Math.max(0, idx - 1));
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryIndex((idx) => Math.min(history.length - 1, idx + 1));
  }, [history.length]);

  const onHistoryChange = useCallback((newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, []);

  const handleRestoreAll = useCallback(() => {
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

  // Use keyboard shortcuts hook
  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    brushSize,
    onBrushSizeChange: setBrushSize,
    zoom,
    onZoomChange: handleZoomChange,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showExportDropdown) {
        setShowExportDropdown(false);
      }
    };

    if (showExportDropdown) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showExportDropdown]);

  return (
    <div className="relative w-screen h-screen">
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
            edgeSoftness={edgeSoftness}
            onHistoryChange={onHistoryChange}
            history={history}
            historyIndex={historyIndex}
            onPointerMove={setBrushPreview}
            panX={panX}
            panY={panY}
            onPanChange={handlePanChange}
            onZoomChange={handleZoomChange}
            onExportReady={(fn) => setExportFunction(() => fn)}
          />
          {brushPreview && (
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
              }}
            />
          )}
          {/* Top toolbar */}
          <div className="absolute top-6 left-6 flex items-center gap-3">
            <button
              onClick={handleLoadNewImage}
              className="p-2 bg-white hover:bg-gray-100 rounded-md shadow-sm border border-gray-200 transition-colors"
              title="Load new image"
            >
              <Upload size={18} className="text-gray-800" />
            </button>
            <div className="w-px h-6 bg-gray-300" />
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-2 bg-white hover:bg-gray-100 disabled:bg-gray-200 disabled:opacity-50 rounded-md shadow-sm border border-gray-200 transition-colors"
              title="Undo (Cmd/Ctrl+Z)"
            >
              <Undo2 size={18} className="text-gray-800" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 bg-white hover:bg-gray-100 disabled:bg-gray-200 disabled:opacity-50 rounded-md shadow-sm border border-gray-200 transition-colors"
              title="Redo (Cmd/Ctrl+Shift+Z)"
            >
              <Redo2 size={18} className="text-gray-800" />
            </button>
            <button
              onClick={handleRestoreAll}
              disabled={historyIndex <= 0}
              className="p-2 bg-white hover:bg-gray-100 disabled:bg-gray-200 disabled:opacity-50 rounded-md shadow-sm border border-gray-200 transition-colors"
              title="Restore to original"
            >
              <RotateCcw size={18} className="text-gray-800" />
            </button>
            <button
              onClick={handleResetView}
              className="p-2 bg-white hover:bg-gray-100 rounded-md shadow-sm border border-gray-200 transition-colors"
              title="Reset view"
            >
              <ZoomOut size={18} className="text-gray-800" />
            </button>
            <div className="w-px h-6 bg-gray-300" />
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={!exportFunction || !isImageLoaded}
                className="flex items-center gap-1 p-2 bg-black hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md shadow-sm transition-colors"
                title="Export options"
              >
                <Download size={18} />
                <ChevronDown size={14} />
              </button>

              {showExportDropdown && (
                <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[160px]">
                  <button
                    onClick={() => {
                      handleExport();
                      setShowExportDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 first:rounded-t-md"
                  >
                    Export Standard
                  </button>
                  <button
                    onClick={() => {
                      handleExportHDR();
                      setShowExportDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 last:rounded-b-md border-t border-gray-100"
                  >
                    Export HDR (.hdr)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="absolute top-6 right-6 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-64">
            <div className="flex items-center gap-2 mb-4">
              <Sliders size={18} className="text-gray-700" />
              <h3 className="font-medium text-gray-900">Brush Settings</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="brush-size"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Size <span className="text-gray-500">({brushSize}) [ ]</span>
                </label>
                <input
                  id="brush-size"
                  type="range"
                  min="1"
                  max="200"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              <div>
                <label
                  htmlFor="brush-strength"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Strength{" "}
                  <span className="text-gray-500">({brushStrength})</span>
                </label>
                <input
                  id="brush-strength"
                  type="range"
                  min="1"
                  max="100"
                  value={brushStrength}
                  onChange={(e) => setBrushStrength(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              <div>
                <label
                  htmlFor="edge-softness"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Edge Softness{" "}
                  <span className="text-gray-500">
                    ({(edgeSoftness * 100).toFixed(0)}%)
                  </span>
                </label>
                <input
                  id="edge-softness"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={edgeSoftness}
                  onChange={(e) => setEdgeSoftness(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              <div>
                <label
                  htmlFor="zoom"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Zoom{" "}
                  <span className="text-gray-500">
                    ({(zoom * 100).toFixed(0)}%) + -
                  </span>
                </label>
                <input
                  id="zoom"
                  type="range"
                  min="1"
                  max="5"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <h1 className="text-5xl font-light text-gray-900 mb-2">Warper</h1>
            <p className="text-gray-600 mb-8">
              Transform your images with precision
            </p>
            <label className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <span className="text-gray-700 font-medium">Choose Image</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
