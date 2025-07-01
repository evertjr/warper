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
  } = useWarperContext();

  return (
    <div
      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-black/90 backdrop-blur-sm border border-gray-700 px-2 py-2 select-none font-mono"
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
        className="p-1.5 hover:bg-gray-800 focus:bg-gray-700 text-gray-300 hover:text-yellow-400 transition-colors focus:outline-none"
        aria-label="Load new image"
      >
        <Upload size={14} />
      </Button>
      <div className="w-px h-4 bg-gray-600" />
      <Button
        onPress={handleUndo}
        isDisabled={historyIndex <= 0}
        className="p-1.5 hover:bg-gray-800 focus:bg-gray-700 disabled:opacity-30 text-gray-300 hover:text-yellow-400 disabled:hover:text-gray-300 transition-colors focus:outline-none"
        aria-label="Undo"
      >
        <Undo2 size={14} />
      </Button>
      <Button
        onPress={handleRedo}
        isDisabled={historyIndex >= history.length - 1}
        className="p-1.5 hover:bg-gray-800 focus:bg-gray-700 disabled:opacity-30 text-gray-300 hover:text-yellow-400 disabled:hover:text-gray-300 transition-colors focus:outline-none"
        aria-label="Redo"
      >
        <Redo2 size={14} />
      </Button>
      <MenuTrigger>
        <Button
          isDisabled={historyIndex <= 0}
          className="p-1.5 hover:bg-gray-800 focus:bg-gray-700 disabled:opacity-30 text-gray-300 hover:text-yellow-400 disabled:hover:text-gray-300 transition-colors focus:outline-none"
          aria-label="Reset"
        >
          <RotateCcw size={14} />
        </Button>
        <Popover className="bg-black border border-gray-700 min-w-[180px] z-50 font-mono">
          <Menu className="outline-none p-1">
            <MenuItem
              onAction={handleRestoreAll}
              className="px-2 py-2 text-xs cursor-pointer outline-none"
            >
              <div className="text-red-400 hover:text-red-300">
                CONFIRM REVERT ALL
              </div>
              <div className="text-gray-500 mt-1">Remove all changes</div>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <Button
        onPress={handleCompareToggle}
        isDisabled={historyIndex <= 0}
        className={`p-1.5 hover:bg-gray-800 focus:bg-gray-700 disabled:opacity-30 transition-colors focus:outline-none ${
          isComparing
            ? "bg-yellow-400/20 text-yellow-400"
            : "text-gray-300 hover:text-yellow-400 disabled:hover:text-gray-300"
        }`}
        aria-label="Compare"
      >
        <SquareSplitHorizontal size={14} />
      </Button>
      <Button
        onPress={handleResetView}
        className="p-1.5 hover:bg-gray-800 focus:bg-gray-700 text-gray-300 hover:text-yellow-400 transition-colors focus:outline-none"
        aria-label="Reset view"
      >
        <ZoomOut size={14} />
      </Button>
      <div className="w-px h-4 bg-gray-600" />
      <MenuTrigger>
        <Button
          isDisabled={!exportFunction || !isImageLoaded}
          className="px-2 ml-1 py-1.5 bg-yellow-400 hover:bg-yellow-300 focus:bg-yellow-300 disabled:bg-gray-700 disabled:cursor-not-allowed text-black disabled:text-gray-500 text-xs font-mono tracking-wider transition-colors focus:outline-none"
          aria-label="Export"
        >
          EXPORT
        </Button>
        <Popover className="bg-black border border-gray-700 min-w-[120px] z-50 font-mono">
          <Menu className="outline-none p-1">
            <MenuItem
              onAction={handleExport}
              className="px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-800 focus:bg-gray-800 hover:text-yellow-400 cursor-pointer outline-none"
            >
              STANDARD
            </MenuItem>
            <MenuItem
              onAction={handleExportHDR}
              className="px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-800 focus:bg-gray-800 hover:text-yellow-400 cursor-pointer outline-none"
            >
              HDR
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
}
