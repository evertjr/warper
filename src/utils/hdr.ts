// Function to create HDR file data in Radiance format
export function createHDRFile(
  floatPixels: Float32Array,
  width: number,
  height: number,
): ArrayBuffer {
  // HDR header
  const header = [
    "#?RADIANCE",
    "# Created by Warper App - HDR Export",
    "FORMAT=32-bit_rle_rgbe",
    "EXPOSURE=1.0",
    "GAMMA=1.0",
    "",
    `-Y ${height} +X ${width}`,
    "",
  ].join("\n");

  const headerBytes = new TextEncoder().encode(header);

  // Convert float RGB to RGBE format
  const rgbeData = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const r = Math.max(0, floatPixels[i * 4]); // Ensure non-negative
    const g = Math.max(0, floatPixels[i * 4 + 1]);
    const b = Math.max(0, floatPixels[i * 4 + 2]);

    // Convert to RGBE format (more robust implementation)
    const max = Math.max(r, g, b);

    if (max < 1e-32) {
      // Black pixel
      rgbeData[i * 4] = 0;
      rgbeData[i * 4 + 1] = 0;
      rgbeData[i * 4 + 2] = 0;
      rgbeData[i * 4 + 3] = 0;
    } else {
      // Calculate exponent more precisely
      let exponent = Math.floor(Math.log2(max)) + 1;

      // Clamp exponent to valid range for RGBE
      exponent = Math.max(-128, Math.min(127, exponent));

      // Calculate mantissa scale
      const scale = Math.pow(2, -exponent) * 256.0;

      // Convert to 8-bit mantissa values
      const rMantissa = Math.min(255, Math.max(0, Math.floor(r * scale + 0.5)));
      const gMantissa = Math.min(255, Math.max(0, Math.floor(g * scale + 0.5)));
      const bMantissa = Math.min(255, Math.max(0, Math.floor(b * scale + 0.5)));

      // Store RGBE values
      rgbeData[i * 4] = rMantissa;
      rgbeData[i * 4 + 1] = gMantissa;
      rgbeData[i * 4 + 2] = bMantissa;
      rgbeData[i * 4 + 3] = exponent + 128; // Bias exponent by 128
    }
  }

  // Combine header and data
  const result = new Uint8Array(headerBytes.length + rgbeData.length);
  result.set(headerBytes, 0);
  result.set(rgbeData, headerBytes.length);

  return result.buffer;
}
