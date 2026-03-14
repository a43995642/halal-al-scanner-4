
import { HalalStatus, ScanResult, Language } from "../types";
import { Capacitor } from '@capacitor/core';
import { checkLocalHaram, checkLocalDatabase } from "./haramKeywords";
import { secureStorage } from "../utils/secureStorage";
import { resizeImageWorker } from "../utils/imageUtils";

// ⚠️ الرابط المباشر للخادم (للأندرويد)
const VERCEL_PROJECT_URL = 'https://halal-al-scanner-4.vercel.app'; 

// MUST MATCH PACKAGE.JSON VERSION
const APP_VERSION = "2.2.0";

const getBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    return VERCEL_PROJECT_URL.replace(/\/$/, '');
  }
  // For web (including localhost and run.app), use relative path to hit the local server
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
  const id = setTimeout(() => controller.abort(), timeout);
  
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
  } catch (error) {
    clearTimeout(id);
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
      const reason = language === 'ar' ? "لا يوجد اتصال بالإنترنت. لا يمكن فحص الصور بدون إنترنت، لكن يمكنك كتابة المكونات يدوياً لفحصها محلياً." : 
                     (language === 'fr' ? "Pas de connexion internet. Vous pouvez taper les ingrédients manuellement pour une vérification locale." : 
                     (language === 'id' ? "Tidak ada koneksi internet. Anda dapat mengetik bahan secara manual untuk pemeriksaan lokal." : 
                     (language === 'tr' ? "İnternet bağlantısı yok. Yerel kontrol için malzemeleri manuel olarak yazabilirsiniz." : 
                     (language === 'de' ? "Keine Internetverbindung. Sie können Zutaten manuell für eine lokale Prüfung eingeben." : 
                     (language === 'ru' ? "Нет подключения к интернету. Вы можете ввести ингредиенты вручную для локальной проверки." : 
                     (language === 'ur' ? "انٹرنیٹ کنکشن نہیں ہے۔ آپ مقامی جانچ کے لیے اجزاء دستی طور پر ٹائپ کر سکتے ہیں۔" : 
                     (language === 'ms' ? "Tiada sambungan internet. Anda boleh menaip bahan secara manual untuk pemeriksaan tempatan." : 
                     (language === 'bn' ? "ইন্টারনেট সংযোগ নেই। আপনি স্থানীয় পরীক্ষার জন্য ম্যানুয়ালি উপাদান টাইপ করতে পারেন।" : 
                     (language === 'zh' ? "无网络连接。您可以手动输入成分进行本地检查。" : 
                     (language === 'fa' ? "اتصال اینترنت وجود ندارد. می توانید مواد را به صورت دستی برای بررسی محلی تایپ کنید." : 
                     (language === 'es' ? "No hay conexión a internet. Puedes escribir los ingredientes manualmente para una verificación local." : 
                     (language === 'hi' ? "कोई इंटरनेट कनेक्शन नहीं। आप स्थानीय जांच के लिए सामग्री मैन्युअल रूप से टाइप कर सकते हैं।" : 
                     (language === 'uz' ? "Internet aloqasi yo'q. Mahalliy tekshirish uchun masalliqlarni qo'lda kiritishingiz mumkin." : 
                     (language === 'kk' ? "Интернет байланысы жоқ. Жергілікті тексеру үшін ингредиенттерді қолмен теруге болады." : 
                     (language === 'ky' ? "Интернет байланышы жок. Жергиликтүү текшерүү үчүн ингредиенттерди кол менен терсеңиз болот." : 
                     (language === 'so' ? "Xiriirka internetka ma jiro. Waad ku qori kartaa maaddooyinka gacanta si aad u hubiso gudaha." : 
                     (language === 'ha' ? "Babu haɗin intanet. Kuna iya rubuta sinadaran da hannu don bincika na gida." : 
                     (language === 'sw' ? "Hakuna muunganisho wa mtandao. Unaweza kuandika viungo kwa mikono kwa ukaguzi wa ndani." : 
                     (language === 'ps' ? "انټرنیټ نشته. تاسو کولی شئ اجزا په لاسي ډول ولیکئ." : "No internet connection. You can type ingredients manually for a local check.")))))))))))))))))));
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
        let targetWidth = 1500;
        let targetQuality = 0.85;

        // Progressive downscaling on retry
        if (attempt === 1) {
            targetWidth = 1024;
            targetQuality = 0.7;
        } else if (attempt === 2) {
            targetWidth = 800;
            targetQuality = 0.6;
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
               reason: language === 'ar' ? "النسخة قديمة. يرجى تحديث التطبيق ليعمل." : 
                       (language === 'fr' ? "Version obsolète. Veuillez mettre à jour l'application." : 
                       (language === 'id' ? "Versi aplikasi usang. Silakan perbarui." : 
                       (language === 'tr' ? "Uygulama sürümü eski. Lütfen güncelleyin." : 
                       (language === 'de' ? "App-Version veraltet. Bitte aktualisieren." : 
                       (language === 'ru' ? "Версия устарела. Пожалуйста, обновите." : 
                       (language === 'ur' ? "ایپ ورژن پرانا ہے۔ براہ کرم اپ ڈیٹ کریں۔" : 
                       (language === 'ms' ? "Versi aplikasi usang. Sila kemas kini." : 
                       (language === 'bn' ? "অ্যাপ সংস্করণ পুরানো। অনুগ্রহ করে আপডেট করুন।" : 
                       (language === 'zh' ? "应用版本过旧。请更新。" : 
                       (language === 'fa' ? "نسخه برنامه قدیمی است. لطفا به روز رسانی کنید." : 
                       (language === 'es' ? "Versión de la aplicación obsoleta. Por favor actualiza." : 
                       (language === 'hi' ? "ऐप संस्करण पुराना है। कृपया अपडेट करें।" : 
                       (language === 'uz' ? "Ilova versiyasi eskirgan. Iltimos, yangilang." : 
                       (language === 'kk' ? "Қолданба нұсқасы ескірген. Жаңартыңыз." : 
                       (language === 'ky' ? "Тиркеме версиясы эскирген. Жаңыртыңыз." : 
                       (language === 'so' ? "Nooca abka waa duugoobay. Fadlan cusbooneysii." : 
                       (language === 'ha' ? "Tsohuwar sigar manhaja. Da fatan za a sabunta." : 
                       (language === 'sw' ? "Toleo la programu limepitwa na wakati. Tafadhali sasisha." : 
                       (language === 'ps' ? "د اپلیکیشن نسخه پخوانۍ ده. مهرباني وکړئ تازه کړئ." : "App version deprecated. Please update."))))))))))))))))))),
               ingredientsDetected: [],
               confidence: 0
             };
        }

        console.warn(`Attempt ${attempt} failed:`, error);

        if (attempt === MAX_RETRIES) {
             const isAr = language === 'ar';
             const isFr = language === 'fr';
             const isId = language === 'id';
             const isTr = language === 'tr';
             const isDe = language === 'de';
             const isRu = language === 'ru';
             const isUr = language === 'ur';
             const isMs = language === 'ms';
             const isBn = language === 'bn';
             const isZh = language === 'zh';
             const isFa = language === 'fa';
             const isEs = language === 'es';
             const isHi = language === 'hi';
             const isUz = language === 'uz';
             const isKk = language === 'kk';
             const isKy = language === 'ky';
             const isSo = language === 'so';
             const isHa = language === 'ha';
             const isSw = language === 'sw';
             const isPs = language === 'ps';
             let userMessage = isAr ? `حدث خطأ غير متوقع. (${error.message})` : `Unexpected error. (${error.message})`;
            
             // Prioritize displaying raw server errors for debugging
             if (error.message.includes("Internal Server Error") || error.message.includes("details")) {
                userMessage = error.message;
             } else if (error.message.includes("NO_INTERNET") || !navigator.onLine) {
                 userMessage = isAr ? "لا يوجد اتصال بالإنترنت." : (isFr ? "Pas de connexion internet." : (isId ? "Tidak ada koneksi internet." : (isTr ? "İnternet bağlantısı yok." : (isDe ? "Keine Internetverbindung." : (isRu ? "Нет интернета." : (isUr ? "انٹرنیٹ کنکشن نہیں ہے۔" : (isMs ? "Tiada sambungan internet." : (isBn ? "ইন্টারনেট সংযোগ নেই।" : (isZh ? "无网络连接。" : (isFa ? "اتصال اینترنت وجود ندارد." : (isEs ? "No hay conexión a internet." : (isHi ? "कोई इंटरनेट कनेक्शन नहीं।" : (isUz ? "Internet aloqasi yo'q." : (isKk ? "Интернет байланысы жоқ." : (isKy ? "Интернет байланышы жок." : (isSo ? "Xiriirka internetka ma jiro." : (isHa ? "Babu haɗin intanet." : (isSw ? "Hakuna muunganisho wa intaneti." : (isPs ? "د انټرنیټ اړیکه نشته." : "No internet connection.")))))))))))))))))));
             } else if (error.name === 'AbortError' || error.message.includes('aborted')) { 
                 userMessage = isAr ? "استغرق الخادم وقتاً طويلاً. قد تكون الصورة كبيرة جداً أو الاتصال بطيء." : 
                                      (isFr ? "Le serveur a expiré. L'image est peut-être trop grande ou la connexion lente." : 
                                      (isId ? "Waktu server habis. Gambar mungkin terlalu besar atau koneksi lambat." : 
                                      (isTr ? "Sunucu zaman aşımına uğradı. Resim çok büyük veya bağlantı yavaş olabilir." : 
                                      (isDe ? "Server-Zeitüberschreitung. Bild könnte zu groß sein oder Verbindung langsam." : 
                                      (isRu ? "Тайм-аут сервера. Фото слишком большое или интернет медленный." : 
                                      (isUr ? "سرور کا وقت ختم ہو گیا۔ تصویر بہت بڑی ہو سکتی ہے یا کنکشن سست ہے۔" : 
                                      (isMs ? "Masa pelayan tamat. Imej mungkin terlalu besar atau sambungan perlahan." : 
                                      (isBn ? "সার্ভারের সময় শেষ। ছবি খুব বড় বা সংযোগ ধীর হতে পারে।" : 
                                      (isZh ? "服务器超时。图片可能太大或网络连接缓慢。" : 
                                      (isFa ? "زمان سرور تمام شد. تصویر ممکن است خیلی بزرگ باشد یا اتصال کند باشد." : 
                                      (isEs ? "El servidor tardó demasiado. La imagen puede ser muy grande o la conexión lenta." : 
                                      (isHi ? "सर्वर का समय समाप्त हो गया। छवि बहुत बड़ी हो सकती है या कनेक्शन धीमा है।" : 
                                      (isUz ? "Server vaqti tugadi. Rasm juda katta yoki aloqa sekin bo'lishi mumkin." : 
                                      (isKk ? "Сервер уақыты бітті. Сурет тым үлкен немесе байланыс баяу болуы мүмкін." : 
                                      (isKy ? "Сервер убактысы бүттү. Сүрөт өтө чоң же байланыш жай болушу мүмкүн." : 
                                      (isSo ? "Waqtiga serverka wuu dhamaaday. Sawirku aad buu u weynaan karaa ama xiriirka ayaa gaabis ah." : 
                                      (isHa ? "Lokacin uwar garken ya kare. Hoto na iya zama babba ko haɗin yana da jinkiri." : 
                                      (isSw ? "Muda wa seva umeisha. Picha inaweza kuwa kubwa sana au muunganisho ni polepole." : 
                                      (isPs ? "د سرور وخت پای ته ورسید. انځور ممکن ډیر لوی وي یا اړیکه سست وي." : "Server timed out. Image might be too large or connection slow.")))))))))))))))))));
             } else if (error.message.includes("HTTP Error") || error.message.includes("Server Error")) {
                 userMessage = isAr ? `واجه الخادم مشكلة مؤقتة. حاول مرة أخرى. (${error.message})` : `Temporary server issue. Please try again. (${error.message})`;
             } else if (error.message.includes("Failed to fetch")) {
                 userMessage = isAr ? "فشل الاتصال بالخادم. تأكد من أنك متصل بالإنترنت." : 
                                      (isFr ? "Échec de la connexion au serveur. Vérifiez internet." : 
                                      (isId ? "Gagal terhubung ke server. Periksa internet." : 
                                      (isTr ? "Sunucuya bağlanılamadı. İnterneti kontrol edin." : 
                                      (isDe ? "Verbindung zum Server fehlgeschlagen. Internet prüfen." : 
                                      (isRu ? "Ошибка подключения к серверу. Проверьте интернет." : 
                                      (isUr ? "سرور سے منسلک ہونے میں ناکام۔ انٹرنیٹ چیک کریں۔" : 
                                      (isMs ? "Gagal menyambung ke pelayan. Semak internet." : 
                                      (isBn ? "সার্ভারের সাথে সংযোগ করতে ব্যর্থ। ইন্টারনেট পরীক্ষা করুন।" : 
                                      (isZh ? "连接服务器失败。请检查网络。" : 
                                      (isFa ? "اتصال به سرور ناموفق بود. اینترنت را بررسی کنید." : 
                                      (isEs ? "Error al conectar con el servidor. Verifica internet." : 
                                      (isHi ? "सर्वर से कनेक्ट करने में विफल। इंटरनेट की जाँच करें।" : 
                                      (isUz ? "Serverga ulanib bo'lmadi. Internetni tekshiring." : 
                                      (isKk ? "Серверге қосылу сәтсіз болды. Интернетті тексеріңіз." : 
                                      (isKy ? "Серверге туташуу ишке ашкан жок. Интернетти текшериңиз." : 
                                      (isSo ? "Ku guuldareystay inuu ku xirmo serverka. Hubi internetka." : 
                                      (isHa ? "An kasa haɗawa da uwar garken. Duba intanet." : 
                                      (isSw ? "Imeshindwa kuunganishwa na seva. Angalia intaneti." : 
                                      (isPs ? "سرور سره په نښلولو کې پاتې راغلی. انټرنیټ وګورئ." : "Failed to connect to server. Check internet.")))))))))))))))))));
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
        reason: (language === 'ar' ? "نتيجة الفحص بدون إنترنت:\n" : "Offline Result:\n") + offlineResult.reason,
        ingredientsDetected: offlineResult.detected,
        confidence: 90
      };
    } else {
      return {
        status: HalalStatus.DOUBTFUL,
        reason: language === 'ar' ? "أنت غير متصل بالإنترنت. لم يتم العثور على مكونات محرمة في قاعدة البيانات المحلية، لكن يرجى الاتصال بالإنترنت للحصول على فحص دقيق بالذكاء الاصطناعي." : "You are offline. No Haram ingredients found in local database, but please connect to the internet for a full AI analysis.",
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
      reason: language === 'ar' ? "تم اكتشاف مكونات محرمة في النص." : 
              (language === 'fr' ? "Ingrédients Haram détectés dans le texte." : 
              (language === 'id' ? "Bahan Haram ditemukan dalam teks." : 
              (language === 'tr' ? "Metinde Haram içerik tespit edildi." : 
              (language === 'de' ? "Haram-Zutaten im Text gefunden." : 
              (language === 'ru' ? "Найдены Харам ингредиенты." : 
              (language === 'ur' ? "متن میں حرام اجزاء پائے گئے۔" : 
              (language === 'ms' ? "Bahan Haram dikesan dalam teks." : 
              (language === 'bn' ? "টেক্সটে হারাম উপাদান পাওয়া গেছে।" : 
              (language === 'zh' ? "文本中发现非清真成分。" : 
              (language === 'fa' ? "مواد حرام در متن یافت شد." : 
              (language === 'es' ? "Ingredientes Haram detectados en el texto." : 
              (language === 'hi' ? "टेक्स्ट में हराम सामग्री मिली।" : 
              (language === 'uz' ? "Matnda Harom tarkib topildi." : 
              (language === 'kk' ? "Мәтінде Харам құрам табылды." : 
              (language === 'ky' ? "Текстте Харам курам табылды." : 
              (language === 'so' ? "Waxyaabaha Xaaraanta ah ayaa laga helay qoraalka." : 
              (language === 'ha' ? "An sami sinadaran Haram a cikin rubutu." : 
              (language === 'sw' ? "Viungo vya Haram vimepatikana kwenye maandishi." : 
              (language === 'ps' ? "په متن کې حرام اجزا وموندل شول." : "Haram ingredients found in text."))))))))))))))))))),
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
          const isAr = language === 'ar';
          const isFr = language === 'fr';
          const isId = language === 'id';
          const isTr = language === 'tr';
          const isDe = language === 'de';
          const isRu = language === 'ru';
          const isUr = language === 'ur';
          const isMs = language === 'ms';
          const isBn = language === 'bn';
          const isZh = language === 'zh';
          const isFa = language === 'fa';
          const isEs = language === 'es';
          const isHi = language === 'hi';
          const isUz = language === 'uz';
          const isKk = language === 'kk';
          const isKy = language === 'ky';
          const isSo = language === 'so';
          const isHa = language === 'ha';
          const isSw = language === 'sw';
          const isPs = language === 'ps';
          const userMessage = isAr ? "النسخة قديمة. يرجى التحديث." : (isFr ? "Mise à jour requise." : (isId ? "Pembaruan diperlukan." : (isTr ? "Güncelleme gerekli." : (isDe ? "Update erforderlich." : (isRu ? "Требуется обновление." : (isUr ? "اپ ڈیٹ درکار ہے۔" : (isMs ? "Kemas kini diperlukan." : (isBn ? "আপডেট প্রয়োজন।" : (isZh ? "需要更新。" : (isFa ? "به روز رسانی لازم است." : (isEs ? "Actualización requerida." : (isHi ? "अपडेट आवश्यक है।" : (isUz ? "Yangilash talab qilinadi." : (isKk ? "Жаңарту қажет." : (isKy ? "Жаңыртуу керек." : (isSo ? "Cusbooneysiin ayaa loo baahan yahay." : (isHa ? "Ana bukatar sabuntawa." : (isSw ? "Sasisho linahitajika." : (isPs ? "تازه کولو ته اړتیا ده." : "Update required.")))))))))))))))))));
          return {
            status: HalalStatus.NON_FOOD,
            reason: userMessage,
            ingredientsDetected: [],
            confidence: 0, 
          };
      }
      
      if (attempt === MAX_RETRIES) {
          const isAr = language === 'ar';
          const isFr = language === 'fr';
          const isId = language === 'id';
          const isTr = language === 'tr';
          const isDe = language === 'de';
          const isRu = language === 'ru';
          const isUr = language === 'ur';
          const isMs = language === 'ms';
          const isBn = language === 'bn';
          const isZh = language === 'zh';
          const isFa = language === 'fa';
          const isEs = language === 'es';
          const isHi = language === 'hi';
          const isUz = language === 'uz';
          const isKk = language === 'kk';
          const isKy = language === 'ky';
          const isSo = language === 'so';
          const isHa = language === 'ha';
          const isSw = language === 'sw';
          const isPs = language === 'ps';
          let userMessage = isAr ? `حدث خطأ غير متوقع. (${error.message})` : `Unexpected error. (${error.message})`;
          
          if (error.name === 'AbortError' || error.message.includes('aborted')) {
              userMessage = isAr ? "انتهت مهلة الاتصال." : (isFr ? "Délai d'attente dépassé." : (isId ? "Waktu permintaan habis." : (isTr ? "İstek zaman aşımına uğradı." : (isDe ? "Zeitüberschreitung der Anfrage." : (isRu ? "Время ожидания истекло." : (isUr ? "درخواست کا وقت ختم ہو گیا۔" : (isMs ? "Permintaan tamat masa." : (isBn ? "অনুরোধের সময় শেষ।" : (isZh ? "请求超时。" : (isFa ? "زمان درخواست تمام شد." : (isEs ? "Tiempo de espera agotado." : (isHi ? "अनुरोध का समय समाप्त हो गया।" : (isUz ? "So'rov vaqti tugadi." : (isKk ? "Сұраныс уақыты бітті." : (isKy ? "Суроо убактысы бүттү." : (isSo ? "Codsiga waqtiga wuu dhamaaday." : (isHa ? "Lokacin buƙata ya kare." : (isSw ? "Muda wa ombi umeisha." : (isPs ? "د غوښتنې وخت پای ته ورسید." : "Request timed out.")))))))))))))))))));
          } else if (error.message.includes("Server Error")) {
              userMessage = error.message; // Show raw server error for debugging
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
