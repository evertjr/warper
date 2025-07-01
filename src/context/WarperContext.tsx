import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import {
  downloadCanvasWithExif,
  extractExifData,
  type ExifData,
} from "../utils/exif";

export type HistoryItem = THREE.Texture;

interface WarperContextValue {
  image: string | null;
  setImage: React.Dispatch<React.SetStateAction<string | null>>;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushStrength: number;
  setBrushStrength: (strength: number) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  panX: number;
  setPanX: (x: number) => void;
  panY: number;
  setPanY: (y: number) => void;
  brushPreview: { x: number; y: number; diameter: number } | null;
  setBrushPreview: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; diameter: number } | null>
  >;
  history: HistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  historyIndex: number;
  setHistoryIndex: React.Dispatch<React.SetStateAction<number>>;
  originalFile: File | null;
  setOriginalFile: React.Dispatch<React.SetStateAction<File | null>>;
  originalImageData: { width: number; height: number; format: string } | null;
  setOriginalImageData: React.Dispatch<
    React.SetStateAction<{
      width: number;
      height: number;
      format: string;
    } | null>
  >;
  exportFunction: any;
  setExportFunction: React.Dispatch<any>;
  isImageLoaded: boolean;
  isComparing: boolean;
  setIsComparing: React.Dispatch<React.SetStateAction<boolean>>;
  exifData: ExifData | null;
  setExifData: React.Dispatch<React.SetStateAction<ExifData | null>>;
  hasWideGamutProfile: boolean;
  setHasWideGamutProfile: React.Dispatch<React.SetStateAction<boolean>>;
  handleImageUpload: (file: File) => Promise<void>;
  handleUndo: () => void;
  handleRedo: () => void;
  handleRestoreAll: () => void;
  handlePanChange: (x: number, y: number) => void;
  handleZoomChange: (z: number) => void;
  handleResetView: () => void;
  handleCompareToggle: () => void;
  onHistoryChange: (h: HistoryItem[]) => void;
  handleExport: () => Promise<void>;
  handleExportHDR: () => Promise<void>;
}

const WarperContext = createContext<WarperContextValue | undefined>(undefined);

export function WarperProvider({ children }: { children: React.ReactNode }) {
  // ---------------------------------------------------------------------
  // Source image & metadata
  // ---------------------------------------------------------------------
  const [image, setImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImageData, setOriginalImageData] = useState<{
    width: number;
    height: number;
    format: string;
  } | null>(null);
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [hasWideGamutProfile, setHasWideGamutProfile] = useState(false);

  // ---------------------------------------------------------------------
  // Brush & interaction
  // ---------------------------------------------------------------------
  const [brushSize, setBrushSize] = useState(50);
  const [brushStrength, setBrushStrength] = useState(50);
  const [brushPreview, setBrushPreview] = useState<{
    x: number;
    y: number;
    diameter: number;
  } | null>(null);

  // ---------------------------------------------------------------------
  // View (zoom & pan)
  // ---------------------------------------------------------------------
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isComparing, setIsComparing] = useState(false);

  // ---------------------------------------------------------------------
  // History & export
  // ---------------------------------------------------------------------
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [exportFunction, setExportFunction] = useState<any>(null);

  // ---------------------------------------------------------------------
  // Mutable refs (do not cause re-renders)
  // ---------------------------------------------------------------------
  const historyRef = useRef<HistoryItem[]>([]);
  const historyIndexRef = useRef(-1);

  // ---------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------
  // Image is considered loaded when we have dimensions > 0
  const isImageLoaded =
    !!originalImageData &&
    originalImageData.width > 0 &&
    originalImageData.height > 0;

  // ---------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
  const handleImageUpload = useCallback(async (file: File) => {
    setOriginalFile(file);
    const extractedExifData = await extractExifData(file);
    setExifData(extractedExifData);
    const hasIccProfile = !!(
      extractedExifData?.iccProfile &&
      extractedExifData.iccProfile.byteLength > 0
    );
    const colorSpace = extractedExifData?.ColorSpace;

    // ---------------------------------------------------------------------
    // Detect wide gamut profiles
    // ---------------------------------------------------------------------
    const isWideGamut =
      hasIccProfile ||
      colorSpace === "Adobe RGB" ||
      colorSpace === "ProPhoto RGB" ||
      colorSpace === 65535;
    setHasWideGamutProfile(isWideGamut);

    // ---------------------------------------------------------------------
    // Load image
    // ---------------------------------------------------------------------
    const isHeif =
      /heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name);
    try {
      let blob: Blob;
      if (isHeif) {
        const heic2any = (await import("heic2any")).default;
        blob = (await heic2any({ blob: file, toType: "image/png" })) as Blob;
      } else {
        blob = file;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === "string") {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", {
              colorSpace: "srgb",
            });
            if (!ctx) {
              setImage(e.target?.result as string);
              return;
            }
            canvas.width = img.width;
            canvas.height = img.height;
            (ctx as CanvasRenderingContext2D).drawImage(img, 0, 0);
            const srgbDataUrl = canvas.toDataURL("image/png", 1.0);
            setImage(srgbDataUrl);
            setOriginalImageData({
              width: img.width,
              height: img.height,
              format: file.type || "image/png",
            });
          };
          img.onerror = () => {
            setImage(e.target?.result as string);
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
          setHistory([]);
          setHistoryIndex(-1);
          setPanX(0);
          setPanY(0);
          setZoom(1);
          setExportFunction(null);
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      alert("Unable to load this image format.");
    }
  }, []);

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
  const handleUndo = useCallback(() => {
    setHistoryIndex((idx) => (idx > 0 ? idx - 1 : idx));
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryIndex((idx) => {
      const currentHistoryLength = historyRef.current.length;
      return idx < currentHistoryLength - 1 ? idx + 1 : idx;
    });
  }, []);

  const onHistoryChange = useCallback((newHistory: HistoryItem[]) => {
    const maxHistorySize = 15;
    if (newHistory.length > maxHistorySize) {
      const toDispose = newHistory.slice(
        1,
        newHistory.length - maxHistorySize + 1,
      );
      toDispose.forEach((texture) => {
        if (texture && texture.dispose) texture.dispose();
      });
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
    if (history.length > 0) setHistoryIndex(0);
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

  // ---------------------------------------------------------------------
  // Export logic
  // ---------------------------------------------------------------------
  const handleExportInternal = useCallback(
    async (hdr = false) => {
      if (!exportFunction || !originalImageData || !isImageLoaded) {
        alert(
          "Export not ready. Please wait for the image to load completely and try again.",
        );
        return;
      }
      if (!originalImageData.width || !originalImageData.height) {
        alert("Invalid image dimensions. Please reload the image.");
        return;
      }
      if (typeof exportFunction !== "function") {
        alert("Export function is not ready. Please try reloading the page.");
        return;
      }
      const { width, height } = originalImageData;
      const exportCanvas = exportFunction(width, height, { hdr });
      if (hdr) return;
      if (
        !exportCanvas ||
        exportCanvas.width === 0 ||
        exportCanvas.height === 0
      ) {
        alert("Export failed. Please try again.");
        return;
      }
      let filename = "warped-image";
      let mimeType = "image/jpeg";
      let quality = 0.95;
      let extension = "jpg";
      if (originalFile) {
        const originalName = originalFile.name.replace(/\.[^/.]+$/, "");
        filename = `${originalName}-edit`;
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
          mimeType = "image/jpeg";
          quality = 0.95;
          extension = "jpg";
        }
      }
      try {
        await downloadCanvasWithExif(
          exportCanvas,
          `${filename}.${extension}`,
          mimeType,
          quality,
          exifData,
        );
      } catch (error) {
        alert(
          "Export failed. The image may be too large or the format unsupported.",
        );
      }
    },
    [exportFunction, originalImageData, isImageLoaded, originalFile, exifData],
  );
  const handleExport = useCallback(
    () => handleExportInternal(false),
    [handleExportInternal],
  );
  const handleExportHDR = useCallback(
    () => handleExportInternal(true),
    [handleExportInternal],
  );

  // ---------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------
  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    brushSize,
    onBrushSizeChange: setBrushSize,
    zoom,
    onZoomChange: handleZoomChange,
  });

  // ---------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------
  const value: WarperContextValue = {
    image,
    setImage,
    brushSize,
    setBrushSize,
    brushStrength,
    setBrushStrength,
    zoom,
    setZoom,
    panX,
    setPanX,
    panY,
    setPanY,
    brushPreview,
    setBrushPreview,
    history,
    setHistory,
    historyIndex,
    setHistoryIndex,
    originalFile,
    setOriginalFile,
    originalImageData,
    setOriginalImageData,
    exportFunction,
    setExportFunction,
    isImageLoaded,
    isComparing,
    setIsComparing,
    exifData,
    setExifData,
    hasWideGamutProfile,
    setHasWideGamutProfile,
    handleImageUpload,
    handleUndo,
    handleRedo,
    handleRestoreAll,
    handlePanChange,
    handleZoomChange,
    handleResetView,
    handleCompareToggle,
    onHistoryChange,
    handleExport,
    handleExportHDR,
  };

  return (
    <WarperContext.Provider value={value}>{children}</WarperContext.Provider>
  );
}

export function useWarperContext() {
  const ctx = useContext(WarperContext);
  if (!ctx)
    throw new Error("useWarperContext must be used within WarperProvider");
  return ctx;
}
