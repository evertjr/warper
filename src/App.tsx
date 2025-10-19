"use client";

import { useMemo } from "react";
import { WarpCanvas } from "./canvas/WarpCanvas";
import { BrushSettingsPopover } from "./components/BrushSettingsPopover";
import { ImageLoader } from "./components/ImageLoader";
import { ImageMetadataOverlay } from "./components/ImageMetadataOverlay";
import { InstallPrompt } from "./components/InstallPrompt";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { Toolbar } from "./components/Toolbar";
import { WarperProvider, useWarperContext } from "./context/WarperContext";

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
          border: "1px solid #facc15",
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
      className="relative bg-black w-screen h-svh touch-none select-none font-mono"
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
        <div className="flex flex-col items-center justify-center h-full bg-black">
          <div className="text-center flex flex-col items-center">
            <img
              src="/icon-192.png"
              alt="Warper"
              className="w-16 h-16 mb-6"
            />
            <h1 className="text-2xl font-mono text-white mb-1">WARPER</h1>
            <p className="text-gray-400 text-xs font-mono mb-8 tracking-wider">
              IMAGE DISPLACEMENT TOOL
            </p>
            <button
              onClick={() => {
                const input =
                  document.querySelector<HTMLInputElement>(
                    'input[type="file"]',
                  );
                if (input) input.click();
              }}
              className="px-4 py-2 border border-gray-600 bg-black hover:bg-gray-900 text-white font-mono text-xs tracking-wider transition-colors focus:outline-none focus:border-yellow-400"
            >
              LOAD IMAGE
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
