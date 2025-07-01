"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { WarpCanvas } from "./canvas/WarpCanvas";
import { BrushSettingsPopover } from "./components/BrushSettingsPopover";
import { ImageLoader } from "./components/ImageLoader";
import { ImageMetadataOverlay } from "./components/ImageMetadataOverlay";
import { InstallPrompt } from "./components/InstallPrompt";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { Toolbar } from "./components/Toolbar";
import { WarperProvider, useWarperContext } from "./context/WarperContext";

export type HistoryItem = THREE.Texture;

function AppContent() {
  const {
    image,
    brushPreview,
    historyIndex,
    history,
    isComparing,
    brushSize,
    brushStrength,
    zoom,
    onHistoryChange,
    setBrushPreview,
    panX,
    panY,
    handlePanChange,
    handleZoomChange,
    setExportFunction,
  } = useWarperContext();

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
      <ImageLoader />
      {image ? (
        <>
          <WarpCanvas
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
          <ImageMetadataOverlay />
          <Toolbar />
          <BrushSettingsPopover />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <h1 className="text-5xl font-light text-gray-900 mb-2">Warper</h1>
            <p className="text-gray-600 mb-8">
              Transform your images with precision
            </p>
            <button
              onClick={() => {
                const input =
                  document.querySelector<HTMLInputElement>(
                    'input[type="file"]',
                  );
                if (input) input.click();
              }}
              className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 focus:bg-gray-100 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span className="text-gray-700 font-medium">Choose Image</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <WarperProvider>
      <AppContent />
    </WarperProvider>
  );
}
