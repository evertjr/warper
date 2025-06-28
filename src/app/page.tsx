"use client";

import { useState, useRef } from "react";
import WarpCanvas from "./WarpCanvas";

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(50);
  const [brushStrength, setBrushStrength] = useState(50);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === "string") {
          setImage(e.target.result);
        }
      };
      reader.readAsDataURL(event.target.files[0]);
    }
  };

  const handleExport = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = 'warped-image.png';
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-white">
      <main className="flex flex-col items-center justify-center flex-1 p-4 text-center">
        <h1 className="text-4xl font-bold mb-4">Image Warper</h1>
        <p className="text-lg mb-8">
          Upload an image and use the brush to warp it.
        </p>
        <div className="w-full max-w-4xl">
          <div className="mb-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="text-black"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 h-[500px]">
              {image && <WarpCanvas ref={canvasRef} image={image} brushSize={brushSize} brushStrength={brushStrength} zoom={zoom} />}
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-gray-200 dark:bg-gray-800 rounded-lg shadow-lg">
              <div className="mb-4 w-full">
                <label
                  htmlFor="brush-size"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Brush Size
                </label>
                <input
                  id="brush-size"
                  type="range"
                  min="1"
                  max="200"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="mb-4 w-full">
                <label
                  htmlFor="brush-strength"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Brush Strength
                </label>
                <input
                  id="brush-strength"
                  type="range"
                  min="1"
                  max="100"
                  value={brushStrength}
                  onChange={(e) => setBrushStrength(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="mb-4 w-full">
                <label
                  htmlFor="zoom"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Zoom
                </label>
                <input
                  id="zoom"
                  type="range"
                  min="1"
                  max="5"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="mt-4 w-full">
                <button
                  onClick={handleExport}
                  className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Export Image
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}