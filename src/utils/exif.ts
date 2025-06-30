import exifr from "exifr";
import piexif from "piexifjs";

export interface ExifData {
  [key: string]: any;
}

/**
 * Extract EXIF data from an image file
 */
export async function extractExifData(file: File): Promise<ExifData | null> {
  try {
    const exifData = await exifr.parse(file, {
      // Parse all available EXIF data
      tiff: true,
      exif: true,
      gps: true,
      icc: true,
      iptc: true,
      xmp: true,
      jfif: true,
      ihdr: true,
      // Include raw data for complete preservation
      pick: undefined, // Get all available data
    });

    if (!exifData || Object.keys(exifData).length === 0) {
      console.log("No EXIF data found in image");
      return null;
    }

    console.log("Extracted EXIF data:", exifData);
    return exifData;
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
      const dataUrlWithExif = piexif.insert(exifBytes, originalDataUrl);

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
