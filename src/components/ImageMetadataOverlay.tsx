import { useWarperContext } from "../context/WarperContext";

export function ImageMetadataOverlay() {
  const { originalImageData, hasWideGamutProfile, exifData, originalFile } =
    useWarperContext();
  if (!originalImageData) return null;

  return (
    <>
      {/* Top left - Image info */}
      <div className="absolute top-4 left-4 text-xs text-white font-mono leading-tight pointer-events-none select-none">
        <div className="bg-black/40 backdrop-blur-sm px-2 py-1 border border-gray-700">
          <div className="text-yellow-400">
            {originalImageData.width} × {originalImageData.height}
          </div>
          <div className="text-gray-300">
            {hasWideGamutProfile ? (
              <span className="text-yellow-400">
                {exifData?.ColorSpace === 65535
                  ? "WIDE GAMUT"
                  : exifData?.ColorSpace === "Adobe RGB"
                    ? "ADOBE"
                    : exifData?.ColorSpace === "ProPhoto RGB"
                      ? "PROPHOTO"
                      : "WIDE GAMUT"}
              </span>
            ) : (
              "sRGB"
            )}
          </div>
          {originalFile && (
            <div className="text-gray-400">
              {(originalFile.size / 1024 / 1024).toFixed(1)}MB
            </div>
          )}
        </div>
      </div>
    </>
  );
}
