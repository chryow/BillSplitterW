import {
  ALLOWED_IMAGE_MIME_TYPES,
  CANVAS_JPEG_QUALITY,
  CANVAS_MAX_WIDTH,
  MAX_UPLOAD_BYTES,
} from "./config";

export interface ProcessedReceiptImage {
  blob: Blob;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  sizeBytes: number;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to compress receipt image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

function loadImageElement(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the selected image."));
    img.src = objectUrl;
  });
}

/**
 * Applies grayscale luminance conversion + gentle contrast boost to improve
 * legibility on faded thermal paper receipts and reduce JPEG payload size.
 */
function enhanceThermalReceiptContrast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const contrast = 1.18;

    for (let i = 0; i < data.length; i += 4) {
      const lum =
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const boosted = Math.max(
        0,
        Math.min(255, Math.round((lum - 128) * contrast + 128))
      );
      data[i] = boosted;
      data[i + 1] = boosted;
      data[i + 2] = boosted;
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Graceful no-op if canvas readback is restricted
  }
}

/**
 * Resizes, respects EXIF orientation, enhances thermal receipt contrast/grayscale,
 * and compresses a receipt image on the client via HTML Canvas (max width 1280px,
 * JPEG quality 0.75) so payloads stay fast, crisp, and < 2 MB.
 */
export async function preprocessReceiptImage(
  file: File
): Promise<ProcessedReceiptImage> {
  if (
    file.type &&
    !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)
  ) {
    throw new Error("Please select a JPEG, PNG, or WebP receipt image.");
  }

  let bitmap: ImageBitmap | null = null;
  let objectUrl: string | null = null;

  try {
    let source: CanvasImageSource;
    let naturalWidth: number;
    let naturalHeight: number;

    if (typeof createImageBitmap === "function") {
      try {
        bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
        source = bitmap;
        naturalWidth = bitmap.width;
        naturalHeight = bitmap.height;
      } catch {
        objectUrl = URL.createObjectURL(file);
        const img = await loadImageElement(objectUrl);
        source = img;
        naturalWidth = img.naturalWidth;
        naturalHeight = img.naturalHeight;
      }
    } else {
      objectUrl = URL.createObjectURL(file);
      const img = await loadImageElement(objectUrl);
      source = img;
      naturalWidth = img.naturalWidth;
      naturalHeight = img.naturalHeight;
    }

    const scale =
      naturalWidth > CANVAS_MAX_WIDTH ? CANVAS_MAX_WIDTH / naturalWidth : 1;
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Browser canvas is unavailable for image compression.");
    }

    // Solid white background so transparent PNGs compress cleanly to JPEG
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    enhanceThermalReceiptContrast(ctx, width, height);

    let blob = await canvasToBlob(canvas, CANVAS_JPEG_QUALITY);

    // If a dense photo still exceeds 2 MB, step down quality once
    if (blob.size > MAX_UPLOAD_BYTES) {
      blob = await canvasToBlob(canvas, 0.55);
    }

    // Clear canvas buffer immediately to release memory
    canvas.width = 0;
    canvas.height = 0;

    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        "Image is still over 2 MB after compression. Try cropping closer to the receipt."
      );
    }

    return {
      blob,
      mimeType: "image/jpeg",
      width,
      height,
      sizeBytes: blob.size,
    };
  } finally {
    if (bitmap) {
      bitmap.close();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
