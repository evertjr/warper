import { useEffect } from "react";

interface UseKeyboardShortcutsProps {
  onUndo: () => void;
  onRedo: () => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  brushSize,
  onBrushSizeChange,
  zoom,
  onZoomChange,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Undo/Redo shortcuts
      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }

      // Brush size shortcuts
      if (event.key === "[") {
        event.preventDefault();
        const newSize = Math.max(1, brushSize - 5);
        onBrushSizeChange(newSize);
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        const newSize = Math.min(200, brushSize + 5);
        onBrushSizeChange(newSize);
        return;
      }

      // Zoom shortcuts
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        onZoomChange(zoom * 1.1);
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        onZoomChange(zoom / 1.1);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onUndo, onRedo, brushSize, onBrushSizeChange, onZoomChange, zoom]);
}
