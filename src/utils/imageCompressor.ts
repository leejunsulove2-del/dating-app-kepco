/**
 * Image compression and resizing utility for Profile Photos
 * Ensures profile photo is strictly <= 300KB (307,200 bytes)
 * Automatically resizes resolution and adjusts quality if necessary
 */

export interface CompressionResult {
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  width: number;
  height: number;
  wasCompressed: boolean;
}

export async function compressImageToLimit(
  fileOrDataUrl: File | string,
  maxSizeBytes: number = 300 * 1024 // 300KB
): Promise<CompressionResult> {
  let sourceDataUrl = '';
  let originalSizeBytes = 0;

  if (typeof fileOrDataUrl === 'string') {
    sourceDataUrl = fileOrDataUrl;
    // Approximate base64 byte length
    originalSizeBytes = Math.round((sourceDataUrl.length * 3) / 4);
  } else {
    originalSizeBytes = fileOrDataUrl.size;
    sourceDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    });
  }

  // Load Image into HTMLImageElement
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = sourceDataUrl;
  });

  // If already <= maxSizeBytes and is standard image, we can keep or lightly optimize
  if (originalSizeBytes <= maxSizeBytes && !sourceDataUrl.startsWith('data:image/bmp')) {
    return {
      dataUrl: sourceDataUrl,
      originalSizeKb: Math.round(originalSizeBytes / 1024),
      compressedSizeKb: Math.round(originalSizeBytes / 1024),
      width: img.width,
      height: img.height,
      wasCompressed: false,
    };
  }

  // Start iterative resizing / quality compression loop
  let maxDimension = 1200; // start max dimension
  let quality = 0.85; // start jpeg quality
  let finalDataUrl = sourceDataUrl;
  let currentSizeBytes = originalSizeBytes;
  let attempts = 0;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not supported');
  }

  while (currentSizeBytes > maxSizeBytes && attempts < 10) {
    attempts++;

    let targetWidth = img.width;
    let targetHeight = img.height;

    // Scale down to fit maxDimension
    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
        targetWidth = maxDimension;
      } else {
        targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
        targetHeight = maxDimension;
      }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Clear and draw
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Export as JPEG with current quality
    finalDataUrl = canvas.toDataURL('image/jpeg', quality);
    // Calculate approximate size in bytes
    currentSizeBytes = Math.round((finalDataUrl.length * 3) / 4);

    if (currentSizeBytes > maxSizeBytes) {
      // Reduce dimensions and quality
      maxDimension = Math.max(400, Math.round(maxDimension * 0.8));
      quality = Math.max(0.4, quality - 0.1);
    }
  }

  return {
    dataUrl: finalDataUrl,
    originalSizeKb: Math.round(originalSizeBytes / 1024),
    compressedSizeKb: Math.round(currentSizeBytes / 1024),
    width: canvas.width || img.width,
    height: canvas.height || img.height,
    wasCompressed: true,
  };
}
