
import { HalalStatus, ScanResult, Language } from "../types";
import { Capacitor } from '@capacitor/core';
import { checkLocalHaram, checkLocalDatabase } from "./haramKeywords";
import { secureStorage } from "../utils/secureStorage";
import { resizeImageWorker } from "../utils/imageUtils";

// الرابط المباشر للخادم (Google Cloud Run)
const CLOUD_RUN_PROJECT_URL = 'https://ais-pre-jplc37xo6vkylwk36rlqka-4975474485.europe-west2.run.app'; 

// MUST MATCH PACKAGE.JSON VERSION
const APP_VERSION = "2.2.0";

const getBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    // Return Cloud Run URL for Native (Android/iOS)
    return CLOUD_RUN_PROJECT_URL.replace(/\/$/, '');
  }
  // For web (including localhost and Cloud Run), use relative path to hit the local Express server
  return '';
};

// وظيفة انتظار
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const downscaleImageIfNeeded = (base64Str: string, maxWidth: number, maxHeight: number, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = img.width;
      const height = img.height;
      if (width <= maxWidth && height <= maxHeight) {
        resolve(base64Str);
        return;
      }
      const ratio = Math.min(maxWidth / width, maxHeight / height);
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

// ⚠️ Strict Timeout to prevent hanging
const fetchWithTimeout = async (resource: RequestInfo, options: RequestInit & { timeout?: number } = {}) => {
  const { timeout = 50000 } = options; // 50 seconds max
  
  const controller = new AbortController();
  let isTimeout = false;
  
  const id = setTimeout(() => {
    isTimeout = true;
    controller.abort();
  }, timeout);
  
  // If user provided a signal (e.g. from UI cancel), link it
  if (options.signal) {
     options.signal.addEventListener('abort', () => {
        clearTimeout(id);
        controller.abort();
     });
  }

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError' && isTimeout) {
      throw new Error('Request timed out');
    }
    throw error;
  }
};

export const analyzeImage = async (
  base64Images: string[], 
  userId?: string,
  _enhance: boolean = false,
  enableImageDownscaling: boolean = true,
  language: Language = 'ar',
  signal?: AbortSignal,
  dietaryPreferences: string[] = []
): Promise<ScanResult> => {
  
  const MAX_RETRIES = 3;

  // Pre-check connectivity
  if (!navigator.onLine) {
      const reason = "noInternetImage";
      return {
          status: HalalStatus.DOUBTFUL,
          reason: reason,
          ingredientsDetected: [],
          confidence: 0
      };
  }

  // Get Ingredient Language Preference
  const ingredientLang = localStorage.getItem('ingredientLangPreference') || 'app';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
        // Optimized for Speed: Smaller base targets (1024 -> 800)
        let targetWidth = 1024;
        let targetQuality = 0.75;

        // Progressive downscaling on retry
        if (attempt === 1) {
            targetWidth = 800;
            targetQuality = 0.65;
        } else if (attempt === 2) {
            targetWidth = 600;
            targetQuality = 0.55;
        }

        const processedImages = await Promise.all(base64Images.map(async (img) => {
            let processed = img;
            // Always downscale to prevent payload size issues, especially on mobile
            // Vercel limit ~4.5MB, so we target ~1MB max per image
            if (enableImageDownscaling || Capacitor.isNativePlatform() || attempt >= 0) {
                // Aggressive downscaling using targetWidth and targetQuality
                processed = await downscaleImageIfNeeded(processed, targetWidth, targetWidth, targetQuality);
            }
            return processed.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
        }));

        const baseUrl = getBaseUrl();
        const endpoint = `${baseUrl}/api/analyze`;
        
        const headers: any = {
            'Content-Type': 'application/json',
            'x-user-id': userId || 'anonymous',
            'x-language': language,
            'x-app-version': APP_VERSION, // CRITICAL for server check
            'x-ingredient-language': ingredientLang // 'app' or 'original'
        };
        
        // Use custom fetch with timeout
        const response = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                images: processedImages,
                dietaryPreferences: dietaryPreferences,
                isPremium: secureStorage.getItem('isPremium', false)
            }),
            signal: signal,
            timeout: attempt === 0 ? 45000 : 55000 // Increase timeout slightly on retries (up to 55s)
        });

        if (!response.ok) {
            if (response.status === 403) {
                 const errData = await response.json().catch(() => ({}));
                 if (errData.error === 'LIMIT_REACHED') throw new Error("LIMIT_REACHED");
            }
            if (response.status === 426) {
                 throw new Error("UPDATE_REQUIRED");
            }
            if (response.status >= 500) {
                const errorBody = await response.json().catch(() => ({}));
                const detailMessage = errorBody.details || `Server Error ${response.status}`;
                throw new Error(detailMessage);
            }
            throw new Error(`HTTP Error ${response.status}`);
        }

        const result = await response.json();
        return result as ScanResult;

    } catch (error: any) {
        if (error.name === 'AbortError') throw error; // User cancelled
        if (error.message === "LIMIT_REACHED") throw error;
        if (error.message === "UPDATE_REQUIRED") {
             return {
               status: HalalStatus.NON_FOOD,
               reason: "updateRequired",
               ingredientsDetected: [],
               confidence: 0
             };
        }

        console.warn(`Attempt ${attempt} failed:`, error);

        if (attempt === MAX_RETRIES) {
             let userMessage = `error_unexpected|${error.message}`;
            
             // Prioritize displaying raw server errors for debugging
             if (error.message.includes("Internal Server Error") || error.message.includes("details")) {
                userMessage = error.message;
             } else if (error.message.includes("NO_INTERNET") || !navigator.onLine) {
                 userMessage = "error_noInternet";
             } else if (error.name === 'AbortError' || error.message.includes('aborted') || error.message.includes('timed out')) { 
                 userMessage = "error_timeout";
             } else if (error.message.includes("HTTP Error") || error.message.includes("Server Error")) {
                 userMessage = `error_serverIssue|${error.message}`;
             } else if (error.message.includes("Failed to fetch")) {
                 userMessage = "error_failedToConnect";
             }

             return {
               status: HalalStatus.NON_FOOD,
               reason: userMessage,
               ingredientsDetected: [],
               confidence: 0, 
             };
        }
        // Exponential Backoff: 1s, 2s, 4s
        await wait(Math.pow(2, attempt) * 1000);
    }
  }
  throw new Error("Unexpected end of loop");
};

export const analyzeText = async (
  text: string, 
  userId?: string,
  language: Language = 'ar',
  signal?: AbortSignal,
  dietaryPreferences: string[] = []
): Promise<ScanResult> => {
  // Check if offline
  if (!navigator.onLine) {
    const offlineResult = checkLocalDatabase(text, language);
    if (offlineResult) {
      return {
        status: offlineResult.status,
        reason: "offlineResult\n" + offlineResult.reason,
        ingredientsDetected: offlineResult.detected,
        confidence: 90
      };
    } else {
      return {
        status: HalalStatus.DOUBTFUL,
        reason: "offlineNoHaram",
        ingredientsDetected: [],
        confidence: 50
      };
    }
  }

  // Fast-path for obvious Haram keywords (even when online)
  const localResult = checkLocalHaram(text);
  if (localResult) {
    return {
      status: HalalStatus.HARAM,
      reason: "haramFoundInText",
      ingredientsDetected: localResult.detected,
      confidence: 100
    };
  }

  // Get Ingredient Language Preference
  const ingredientLang = localStorage.getItem('ingredientLangPreference') || 'app';
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const baseUrl = getBaseUrl();
      const endpoint = `${baseUrl}/api/analyze`;

      const headers: any = {
          'Content-Type': 'application/json',
          'x-user-id': userId || 'anonymous',
          'x-language': language,
          'x-app-version': APP_VERSION, // CRITICAL
          'x-ingredient-language': ingredientLang
      };

      const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ 
              text: text,
              dietaryPreferences: dietaryPreferences,
              isPremium: secureStorage.getItem('isPremium', false)
          }),
          signal,
          timeout: attempt === 0 ? 40000 : 50000
      });

      if (!response.ok) {
          if (response.status === 403) {
               const errData = await response.json().catch(() => ({}));
               if (errData.error === 'LIMIT_REACHED') throw new Error("LIMIT_REACHED");
          }
          if (response.status === 426) throw new Error("UPDATE_REQUIRED");
          if (response.status >= 500) throw new Error(`Server Error: ${response.status}`);
          throw new Error(`HTTP Error: ${response.status}`);
      }
      const result = await response.json();
      return result as ScanResult;

    } catch (error: any) {
      if (error.name === 'AbortError') throw error;
      if (error.message === "LIMIT_REACHED") throw error;
      if (error.message === "UPDATE_REQUIRED") {
          return {
            status: HalalStatus.NON_FOOD,
            reason: "updateRequired",
            ingredientsDetected: [],
            confidence: 0, 
          };
      }
      
      if (attempt === MAX_RETRIES) {
          let userMessage = `error_unexpected|${error.message}`;
          
          if (error.name === 'AbortError' || error.message.includes('aborted') || error.message.includes('timed out')) {
              userMessage = "error_timeout";
          } else if (error.message.includes("Server Error")) {
              userMessage = `error_serverIssue|${error.message}`;
          } else if (error.message.includes("Failed to fetch")) {
              userMessage = "error_failedToConnect";
          }

          return {
            status: HalalStatus.NON_FOOD,
            reason: userMessage,
            ingredientsDetected: [],
            confidence: 0, 
          };
      }
      
      // Exponential Backoff: 1s, 2s, 4s
      await wait(Math.pow(2, attempt) * 1000);
    }
  }
  throw new Error("Unexpected end of loop");
};
