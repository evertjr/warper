import {
  Redo2,
  RotateCcw,
  SquareSplitHorizontal,
  Undo2,
  Upload,
  ZoomOut,
} from "lucide-react";
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "react-aria-components";
import { useWarperContext } from "../context/WarperContext";

export function Toolbar() {
  const {
    handleUndo,
    handleRedo,
    handleRestoreAll,
    handleCompareToggle,
    handleResetView,
    handleExport,
    handleExportHDR,
    historyIndex,
    history,
    isComparing,
    exportFunction,
    isImageLoaded,
    handleImageUpload,
  } = useWarperContext();

  return (
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
        onPress={() => {
          const input =
            document.querySelector<HTMLInputElement>('input[type="file"]');
          if (input) input.click();
        }}
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
  );
}
