import exifr from "exifr";
import piexif from "piexifjs";

export interface ExifData {
  [key: string]: any;
  iccProfile?: ArrayBuffer; // Add ICC profile data
}

/**
 * Extract EXIF data from an image file
 */
export async function extractExifData(file: File): Promise<ExifData | null> {
  try {
    console.log("Extracting EXIF from file:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    const exifData = await exifr.parse(file, {
      // Parse all available EXIF data
      tiff: true,
      exif: true,
      gps: true,
      icc: true, // Enable ICC profile extraction
      iptc: true,
      xmp: true,
      jfif: true,
      ihdr: true,
      // Include raw data for complete preservation
      pick: undefined, // Get all available data
    });

    console.log("Raw EXIF data:", exifData);

    if (!exifData || Object.keys(exifData).length === 0) {
      console.log("No EXIF data found in image");
      return null;
    }

    // Extract ICC profile separately if available
    let iccProfile: ArrayBuffer | undefined;
    try {
      console.log("Attempting to extract ICC profile...");
      const iccData = await exifr.parse(file, {
        icc: true,
        pick: ["icc"],
        mergeOutput: false,
      });
      console.log("ICC extraction result:", iccData);

      if (iccData && iccData.icc) {
        // exifr returns ICC as ArrayBuffer or Uint8Array
        iccProfile =
          iccData.icc instanceof ArrayBuffer
            ? iccData.icc
            : iccData.icc.buffer.slice(
                iccData.icc.byteOffset,
                iccData.icc.byteOffset + iccData.icc.byteLength,
              );
        console.log("ICC profile extracted:", {
          size: iccProfile?.byteLength || 0,
          type: typeof iccData.icc,
          isArrayBuffer: iccData.icc instanceof ArrayBuffer,
          isUint8Array: iccData.icc instanceof Uint8Array,
          colorSpace: exifData.ColorSpace || "unknown",
        });
      } else {
        console.log("No ICC profile found in image");
      }
    } catch (iccError) {
      console.warn("Failed to extract ICC profile:", iccError);
    }

    const result = {
      ...exifData,
      ...(iccProfile ? { iccProfile } : {}),
    };

    console.log("Extracted EXIF data:", result);
    return result;
  } catch (error) {
    console.warn("Failed to extract EXIF data:", error);
    return null;
  }
}

/**
 * Convert canvas to blob with EXIF data preserved
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
  exifData: ExifData | null,
): Promise<Blob> {
  // For most browsers, toDataURL is synchronous and safe for reasonably sized images.
  // It avoids the massive stack usage of spreading Uint8Array into String.fromCharCode.
  return new Promise(async (resolve, reject) => {
    try {
      // Generate data URL from canvas directly
      const originalDataUrl = canvas.toDataURL(mimeType, quality);

      // If no EXIF data or not a JPEG, return blob from original data URL
      if (!exifData || !mimeType.includes("jpeg")) {
        const blob = await (await fetch(originalDataUrl)).blob();
        resolve(blob);
        return;
      }

      // Prepare EXIF data dictionary
      const exifDict = prepareExifForPiexif(exifData);
      const exifBytes = piexif.dump(exifDict);

      // Insert EXIF data
      let dataUrlWithExif = piexif.insert(exifBytes, originalDataUrl);

      // Handle ICC profile if present
      if (exifData.iccProfile && exifData.iccProfile.byteLength > 0) {
        try {
          // Insert ICC profile as APP2 segment
          // This is a simplified approach - in a full implementation you'd want
          // to properly chunk large ICC profiles across multiple APP2 segments
          dataUrlWithExif = insertIccProfile(
            dataUrlWithExif,
            exifData.iccProfile,
          );
          console.log("ICC profile embedded in exported JPEG");
        } catch (iccError) {
          console.warn("Failed to embed ICC profile:", iccError);
          // Continue with EXIF-only export
        }
      }

      const blobWithExif = await (await fetch(dataUrlWithExif)).blob();
      resolve(blobWithExif);
    } catch (error) {
      console.warn(
        "Failed to inject EXIF data, returning original blob:",
        error,
      );
      // Fallback – generate simple blob
      canvas.toBlob(
        (fallbackBlob) => {
          if (fallbackBlob) resolve(fallbackBlob);
          else reject(error);
        },
        mimeType,
        quality,
      );
    }
  });
}

/**
 * Insert ICC profile into JPEG data URL as APP2 segment
 * This is a simplified implementation for basic ICC profile support
 */
function insertIccProfile(dataUrl: string, iccProfile: ArrayBuffer): string {
  try {
    // Convert data URL to binary
    const binaryString = atob(dataUrl.split(",")[1]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Find SOI marker (0xFFD8)
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      throw new Error("Invalid JPEG format");
    }

    // Create ICC APP2 segment
    const iccData = new Uint8Array(iccProfile);
    const iccHeader = new TextEncoder().encode("ICC_PROFILE\0");
    const seqNum = 1; // Sequence number (1-based)
    const totalSeq = 1; // Total number of sequences

    // APP2 marker (0xFFE2) + length + ICC header + sequence info + ICC data
    const segmentData = new Uint8Array(
      2 + 2 + iccHeader.length + 2 + iccData.length,
    );

    let offset = 0;
    segmentData[offset++] = 0xff; // APP2 marker
    segmentData[offset++] = 0xe2;

    // Length (big-endian, includes length bytes themselves)
    const segmentLength = segmentData.length - 2;
    segmentData[offset++] = (segmentLength >> 8) & 0xff;
    segmentData[offset++] = segmentLength & 0xff;

    // ICC header
    segmentData.set(iccHeader, offset);
    offset += iccHeader.length;

    // Sequence info
    segmentData[offset++] = seqNum;
    segmentData[offset++] = totalSeq;

    // ICC data
    segmentData.set(iccData, offset);

    // Insert ICC segment after SOI (position 2)
    const result = new Uint8Array(bytes.length + segmentData.length);
    result.set(bytes.slice(0, 2), 0); // SOI
    result.set(segmentData, 2); // ICC segment
    result.set(bytes.slice(2), 2 + segmentData.length); // Rest of JPEG

    // Convert back to data URL
    let binaryStr = "";
    for (let i = 0; i < result.length; i++) {
      binaryStr += String.fromCharCode(result[i]);
    }

    return `data:image/jpeg;base64,${btoa(binaryStr)}`;
  } catch (error) {
    console.warn("Failed to insert ICC profile:", error);
    return dataUrl; // Return original if insertion fails
  }
}

/**
 * Prepare EXIF data for piexif format
 */
function prepareExifForPiexif(exifData: ExifData): any {
  const exifDict: any = {
    "0th": {},
    Exif: {},
    GPS: {},
    "1st": {},
    thumbnail: null,
  };

  // Helper function to safely convert values
  const safeValue = (
    value: any,
    expectedType: "string" | "number" | "array" = "string",
  ): any => {
    if (value === null || value === undefined) return null;

    switch (expectedType) {
      case "string":
        return String(value);
      case "number":
        const num = Number(value);
        return isNaN(num) ? null : num;
      case "array":
        return Array.isArray(value) ? value : null;
      default:
        return value;
    }
  };

  // Map common EXIF fields to piexif format with safe conversion
  try {
    // Basic image info - strings
    const make = safeValue(exifData.Make, "string");
    if (make) exifDict["0th"][piexif.ImageIFD.Make] = make;

    const model = safeValue(exifData.Model, "string");
    if (model) exifDict["0th"][piexif.ImageIFD.Model] = model;

    const software = safeValue(exifData.Software, "string");
    if (software) exifDict["0th"][piexif.ImageIFD.Software] = software;

    const dateTime = safeValue(exifData.DateTime, "string");
    if (dateTime) exifDict["0th"][piexif.ImageIFD.DateTime] = dateTime;

    const artist = safeValue(exifData.Artist, "string");
    if (artist) exifDict["0th"][piexif.ImageIFD.Artist] = artist;

    const copyright = safeValue(exifData.Copyright, "string");
    if (copyright) exifDict["0th"][piexif.ImageIFD.Copyright] = copyright;

    // Orientation - number
    const orientation = safeValue(exifData.Orientation, "number");
    if (orientation !== null && orientation >= 1 && orientation <= 8) {
      exifDict["0th"][piexif.ImageIFD.Orientation] = orientation;
    }

    // Camera settings - handle fractions carefully
    if (exifData.ExposureTime) {
      const exposureTime = exifData.ExposureTime;
      if (typeof exposureTime === "number") {
        // Convert decimal to fraction [numerator, denominator]
        const denominator = 1000;
        const numerator = Math.round(exposureTime * denominator);
        exifDict["Exif"][piexif.ExifIFD.ExposureTime] = [
          numerator,
          denominator,
        ];
      } else if (Array.isArray(exposureTime) && exposureTime.length === 2) {
        exifDict["Exif"][piexif.ExifIFD.ExposureTime] = exposureTime;
      }
    }

    if (exifData.FNumber) {
      const fNumber = exifData.FNumber;
      if (typeof fNumber === "number") {
        // Convert to fraction [numerator, denominator]
        const denominator = 100;
        const numerator = Math.round(fNumber * denominator);
        exifDict["Exif"][piexif.ExifIFD.FNumber] = [numerator, denominator];
      } else if (Array.isArray(fNumber) && fNumber.length === 2) {
        exifDict["Exif"][piexif.ExifIFD.FNumber] = fNumber;
      }
    }

    const iso = safeValue(exifData.ISO, "number");
    if (iso !== null) exifDict["Exif"][piexif.ExifIFD.ISOSpeedRatings] = iso;

    const dateTimeOriginal = safeValue(exifData.DateTimeOriginal, "string");
    if (dateTimeOriginal)
      exifDict["Exif"][piexif.ExifIFD.DateTimeOriginal] = dateTimeOriginal;

    const dateTimeDigitized = safeValue(exifData.DateTimeDigitized, "string");
    if (dateTimeDigitized)
      exifDict["Exif"][piexif.ExifIFD.DateTimeDigitized] = dateTimeDigitized;

    if (exifData.FocalLength) {
      const focalLength = exifData.FocalLength;
      if (typeof focalLength === "number") {
        // Convert to fraction [numerator, denominator]
        const denominator = 100;
        const numerator = Math.round(focalLength * denominator);
        exifDict["Exif"][piexif.ExifIFD.FocalLength] = [numerator, denominator];
      } else if (Array.isArray(focalLength) && focalLength.length === 2) {
        exifDict["Exif"][piexif.ExifIFD.FocalLength] = focalLength;
      }
    }

    const lensModel = safeValue(exifData.LensModel, "string");
    if (lensModel) exifDict["Exif"][piexif.ExifIFD.LensModel] = lensModel;

    // GPS data - handle with care
    if (
      typeof exifData.latitude === "number" &&
      typeof exifData.longitude === "number"
    ) {
      try {
        const latDMS = degToDMS(Math.abs(exifData.latitude));
        const lonDMS = degToDMS(Math.abs(exifData.longitude));

        exifDict["GPS"][piexif.GPSIFD.GPSLatitude] = latDMS;
        exifDict["GPS"][piexif.GPSIFD.GPSLongitude] = lonDMS;
        exifDict["GPS"][piexif.GPSIFD.GPSLatitudeRef] =
          exifData.latitude >= 0 ? "N" : "S";
        exifDict["GPS"][piexif.GPSIFD.GPSLongitudeRef] =
          exifData.longitude >= 0 ? "E" : "W";
      } catch (gpsError) {
        console.warn("Error processing GPS data:", gpsError);
      }
    }

    // Add processing software info
    exifDict["0th"][piexif.ImageIFD.Software] = "Warper App - Image Editor";
  } catch (error) {
    console.warn("Error preparing EXIF data:", error);
  }

  return exifDict;
}

/**
 * Convert decimal degrees to degrees, minutes, seconds format for GPS
 */
function degToDMS(
  deg: number,
): [[number, number], [number, number], [number, number]] {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;

  return [
    [degrees, 1],
    [minutes, 1],
    [Math.round(seconds * 1000), 1000],
  ];
}

/**
 * Create a download link with preserved EXIF data
 */
export async function downloadCanvasWithExif(
  canvas: HTMLCanvasElement,
  filename: string,
  mimeType: string,
  quality: number,
  exifData: ExifData | null,
): Promise<void> {
  try {
    const blob = await canvasToBlob(canvas, mimeType, quality, exifData);

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to download image with EXIF:", error);
    throw error;
  }
}
