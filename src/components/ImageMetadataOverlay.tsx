import { useWarperContext } from "../context/WarperContext";

export function ImageMetadataOverlay() {
  const { originalImageData, hasWideGamutProfile, exifData, originalFile } =
    useWarperContext();
  if (!originalImageData) return null;
  return (
    <div className="absolute top-4 left-4 text-xs text-white/80 font-mono leading-relaxed pointer-events-none select-none">
      <div className="bg-black/20 backdrop-blur-sm rounded px-2 py-1">
        <div>
          {originalImageData.width} × {originalImageData.height}
        </div>
        {hasWideGamutProfile && (
          <div className="text-yellow-300/90">
            {exifData?.ColorSpace === 65535
              ? "Wide Gamut"
              : exifData?.ColorSpace === "Adobe RGB"
                ? "Adobe RGB"
                : exifData?.ColorSpace === "ProPhoto RGB"
                  ? "ProPhoto RGB"
                  : "Wide Gamut"}
          </div>
        )}
        {!hasWideGamutProfile && <div className="text-green-300/90">sRGB</div>}
        {originalFile && (
          <div className="text-white/60">
            {(originalFile.size / 1024 / 1024).toFixed(1)}MB
          </div>
        )}
      </div>
    </div>
  );
}
