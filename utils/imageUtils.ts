// 1. AI PIPELINE (Aggressive OCR Optimization)
// This generates the "ugly" but machine-readable version.

let worker: Worker | null = null;
let messageId = 0;
const callbacks = new Map<number, { resolve: (val: string) => void, reject: (err: any) => void }>();

if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
  worker = new Worker(new URL('./imageWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const { id, success, base64, error } = e.data;
    const cb = callbacks.get(id);
    if (cb) {
      if (success) cb.resolve(base64);
      else cb.reject(new Error(error));
      callbacks.delete(id);
    }
  };
}

export const createAIOptimizedImage = (base64Str: string, maxWidth = 3000, quality = 0.9): Promise<string> => {
  return new Promise((resolve) => {
    // Use Web Worker if available
    if (worker) {
      const id = ++messageId;
      callbacks.set(id, {
        resolve: (res) => resolve(res),
        reject: () => {
          // Fallback to main thread on worker error
          fallbackAIOptimizedImage(base64Str, maxWidth, quality).then(resolve);
        }
      });
      worker.postMessage({ id, base64Str, maxWidth, quality, applyFilter: true });
      return;
    }

    // Fallback to Main Thread
    fallbackAIOptimizedImage(base64Str, maxWidth, quality).then(resolve);
  });
};

export const resizeImageWorker = (base64Str: string, maxWidth = 1024, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    // Use Web Worker if available
    if (worker) {
      const id = ++messageId;
      callbacks.set(id, {
        resolve: (res) => resolve(res),
        reject: () => {
          // Fallback to main thread on worker error
          fallbackResizeImage(base64Str, maxWidth, quality).then(resolve);
        }
      });
      worker.postMessage({ id, base64Str, maxWidth, quality, applyFilter: false });
      return;
    }

    // Fallback to Main Thread
    fallbackResizeImage(base64Str, maxWidth, quality).then(resolve);
  });
};

const fallbackResizeImage = (base64Str: string, maxWidth = 1024, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = img.width;
      const height = img.height;
      if (width <= maxWidth) {
        resolve(base64Str);
        return;
      }
      const ratio = maxWidth / width;
      const newWidth = Math.round(width * ratio);
      const newHeight = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64Str); return; }
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

const fallbackAIOptimizedImage = (base64Str: string, maxWidth = 3000, quality = 0.9): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // High Res for AI (Keep it as large as reasonable)
      // Increased maxWidth to 3000 to capture small text details
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // --- THE AI "MAGIC SAUCE" FILTER ---
        // Updated for Low Light / Low Contrast / Metallic text issues:
        // 1. grayscale(100%): Removes color interference (golden text on yellow pack).
        // 2. contrast(1.75): VERY aggressive contrast to separate text from background.
        // 3. brightness(1.2): Slight brightness boost to help with low light shadows.
        // 4. saturate(0): Redundant with grayscale but ensures purity.
        ctx.filter = 'grayscale(100%) contrast(1.75) brightness(1.2) saturate(0%)';
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Return High Quality JPEG for the AI
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

// 2. USER PIPELINE (Aesthetic Optimization - Optional)
// This ensures the thumbnails looking nice. Currently, passing through RAW is best for speed.
export const optimizeImageForDisplay = (base64Str: string): Promise<string> => {
   // We can add slight compression here for memory management if needed, 
   // but for now, we return raw to keep it snappy.
   return Promise.resolve(base64Str);
};