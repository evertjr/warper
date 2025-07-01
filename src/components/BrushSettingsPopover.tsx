import { Brush } from "lucide-react";
import {
  Button,
  Dialog,
  DialogTrigger,
  OverlayArrow,
  Popover,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import { useWarperContext } from "../context/WarperContext";

export function BrushSettingsPopover() {
  const {
    brushSize,
    setBrushSize,
    brushStrength,
    setBrushStrength,
    zoom,
    setZoom,
  } = useWarperContext();

  return (
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
  );
}
