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

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the selected image."));
    img.src = objectUrl;
  });
}

/**
 * Resizes and compresses a receipt image on the client via HTML Canvas
 * (max width 1280px, JPEG quality 0.75) so payloads stay fast and < 2 MB.
 * Immediately revokes the temporary object URL in a finally block.
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

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImage(objectUrl);
    const scale =
      img.naturalWidth > CANVAS_MAX_WIDTH
        ? CANVAS_MAX_WIDTH / img.naturalWidth
        : 1;
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Browser canvas is unavailable for image compression.");
    }

    // Fill white background so transparent PNGs compress cleanly to JPEG
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, CANVAS_JPEG_QUALITY);

    // If a very dense photo still exceeds 2 MB, gently step down quality once
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
    URL.revokeObjectURL(objectUrl);
  }
}
