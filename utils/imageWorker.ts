// /utils/imageWorker.ts

self.onmessage = async (e: MessageEvent) => {
  const { id, base64Str, maxWidth, quality, applyFilter = true } = e.data;

  try {
    // Convert base64 to Blob
    const response = await fetch(base64Str);
    const blob = await response.blob();

    // Create ImageBitmap
    const imageBitmap = await createImageBitmap(blob);
    
    let width = imageBitmap.width;
    let height = imageBitmap.height;

    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    // Use OffscreenCanvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Apply filters if requested
      if (applyFilter) {
        ctx.filter = 'grayscale(100%) contrast(1.75) brightness(1.2) saturate(0%)';
      }
      ctx.drawImage(imageBitmap, 0, 0, width, height);

      const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        self.postMessage({ id, success: true, base64: reader.result });
      };
      reader.onerror = () => {
        self.postMessage({ id, success: false, error: 'Failed to read blob' });
      }
      reader.readAsDataURL(outBlob);
    } else {
      self.postMessage({ id, success: false, error: 'No 2d context' });
    }
  } catch (error: any) {
    self.postMessage({ id, success: false, error: error.message });
  }
};
