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
      className="absolute top-4 right-4 select-none font-mono"
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
          className="p-2 bg-black/90 backdrop-blur-sm hover:bg-gray-900 focus:bg-gray-800 border border-gray-700 text-gray-300 hover:text-yellow-400 transition-colors focus:outline-none"
          aria-label="Brush settings"
        >
          <Brush size={16} />
        </Button>
        <Popover className="bg-black border border-gray-700 p-3 w-48 z-50 font-mono">
          <OverlayArrow>
            <svg
              width={12}
              height={12}
              viewBox="0 0 12 12"
              className="block fill-black stroke-gray-700 stroke-1"
            >
              <path d="M0 0 L6 6 L12 0" />
            </svg>
          </OverlayArrow>
          <Dialog className="outline-none">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs text-yellow-400 mb-3 tracking-wider">
                  BRUSH
                </h3>
              </div>

              <div className="space-y-3">
                <div>
                  <Slider
                    value={brushSize}
                    onChange={setBrushSize}
                    minValue={1}
                    maxValue={200}
                    className="flex flex-col gap-1"
                    aria-label="Brush size"
                  >
                    <div className="flex justify-between text-xs">
                      <label className="text-gray-300">SIZE</label>
                      <SliderOutput className="text-yellow-400">
                        {({ state }) => `${state.getThumbValue(0)}`}
                      </SliderOutput>
                    </div>
                    <SliderTrack className="relative w-full h-1 bg-gray-800">
                      <SliderThumb className="w-3 h-3 mt-0.5 bg-yellow-400 border border-gray-600 focus:border-yellow-300 focus:outline-none transition-colors" />
                    </SliderTrack>
                  </Slider>
                </div>

                <div>
                  <Slider
                    value={brushStrength}
                    onChange={setBrushStrength}
                    minValue={1}
                    maxValue={100}
                    className="flex flex-col gap-1"
                    aria-label="Brush strength"
                  >
                    <div className="flex justify-between text-xs">
                      <label className="text-gray-300">STRENGTH</label>
                      <SliderOutput className="text-yellow-400">
                        {({ state }) => `${state.getThumbValue(0)}`}
                      </SliderOutput>
                    </div>
                    <SliderTrack className="relative w-full h-1 bg-gray-800">
                      <SliderThumb className="w-3 h-3 mt-0.5 bg-yellow-400 border border-gray-600 focus:border-yellow-300 focus:outline-none transition-colors" />
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
                    className="flex flex-col gap-1"
                    aria-label="Zoom level"
                  >
                    <div className="flex justify-between text-xs">
                      <label className="text-gray-300">ZOOM</label>
                      <SliderOutput className="text-yellow-400">
                        {({ state }) =>
                          `${Math.round(state.getThumbValue(0) * 100)}%`
                        }
                      </SliderOutput>
                    </div>
                    <SliderTrack className="relative w-full h-1 bg-gray-800">
                      <SliderThumb className="w-3 h-3 mt-0.5 bg-yellow-400 border border-gray-600 focus:border-yellow-300 focus:outline-none transition-colors" />
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
