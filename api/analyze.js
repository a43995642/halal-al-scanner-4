
// Vercel Serverless Function
// This runs on the server. The API Key is SAFE here.

import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// Configuration from Environment Variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use SERVICE_ROLE_KEY for admin privileges (bypasses RLS to write scan counts safely)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// MINIMUM ALLOWED VERSION
// أي نسخة تطبيق لا ترسل هذا الإصدار أو أعلى سيتم رفضها فوراً
const MIN_APP_VERSION = "2.2.0";

// Initialize Supabase Admin Client
// We use a try-catch or safe init to prevent crash on module load if keys are missing
let supabase;
try {
    if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
    }
} catch (e) {
    console.error("Failed to init Supabase client:", e);
}

export default async function handler(request, response) {
  // 1. permissive CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-user-id, x-language, x-app-version, x-ingredient-language, x-dietary-preferences, x-is-premium'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // --- KILL SWITCH LOGIC ---
    // Check for App Version Header
    const appVersion = request.headers['x-app-version'];
    
    // إذا لم يرسل التطبيق رقم الإصدار (النسخ القديمة) أو كان الإصدار قديماً
    if (!appVersion || appVersion < MIN_APP_VERSION) {
        return response.status(426).json({ 
            error: 'UPDATE_REQUIRED', 
            message: 'هذه النسخة من التطبيق قديمة وتوقفت عن العمل. يرجى تحديث التطبيق أو التواصل مع المطور.',
            reason: 'Deprecated API Version'
        });
    }
    // -------------------------

    const { images, text, dietaryPreferences: bodyDietaryPrefs, isPremium: bodyIsPremium } = request.body;
    const userId = request.headers['x-user-id'];
    const language = request.headers['x-language'] || 'ar'; // Default to Arabic
    const ingredientMode = request.headers['x-ingredient-language'] || 'app'; // 'app' (translated) or 'original'
    
    // Fallback to headers if body doesn't have them (for backward compatibility)
    const dietaryPrefsHeader = request.headers['x-dietary-preferences'];
    let dietaryPreferences = bodyDietaryPrefs || [];
    if (!bodyDietaryPrefs && dietaryPrefsHeader) {
        try {
            dietaryPreferences = JSON.parse(dietaryPrefsHeader);
        } catch(e) {}
    }
    
    // Commercial Mode: Use Developer Key Only
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("Server missing API Key");
      return response.status(500).json({ 
        error: 'CONFIGURATION_ERROR', 
        message: 'Missing Google API Key in environment.' 
      });
    }

    // Check User Stats
    // Always check quota since custom keys are no longer allowed
    if (userId && userId !== 'anonymous' && supabase) {
        try {
            const { data: userStats, error: dbError } = await supabase
              .from('user_stats')
              .select('scan_count, is_premium')
              .eq('id', userId)
              .single();
            
            let currentCount = 0;
            let isPremium = bodyIsPremium !== undefined ? bodyIsPremium : (request.headers['x-is-premium'] === 'true'); // Trust client for now to avoid sync issues with RevenueCat

            if (userStats) {
                currentCount = userStats.scan_count;
                // If DB says premium, trust DB. If client says premium, trust client.
                isPremium = isPremium || userStats.is_premium;
            } 
            
            if (!isPremium && currentCount >= 3 && !dbError) {
                 return response.status(403).json({ error: 'LIMIT_REACHED', message: 'Upgrade required' });
            }
        } catch (dbEx) {
            console.warn("Database check failed, proceeding:", dbEx);
        }
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    const languageNames = {
        ar: "ARABIC",
        fr: "FRENCH",
        id: "INDONESIAN",
        tr: "TURKISH",
        de: "GERMAN",
        ru: "RUSSIAN",
        ur: "URDU",
        ms: "MALAY",
        bn: "BENGALI",
        zh: "SIMPLIFIED CHINESE",
        fa: "FARSI (PERSIAN)",
        es: "SPANISH",
        hi: "HINDI",
        uz: "UZBEK",
        kk: "KAZAKH",
        ky: "KYRGYZ",
        so: "SOMALI",
        ha: "HAUSA",
        sw: "SWAHILI",
        ps: "PASHTO",
        tl: "TAGALOG",
        ku: "KURDISH",
        ml: "MALAYALAM",
        en: "ENGLISH"
    };
    
    const langName = languageNames[language] || "ENGLISH";

    let translationInstruction = "";
    if (ingredientMode === 'original') {
        translationInstruction = "EXTRACT INGREDIENT NAMES EXACTLY AS THEY APPEAR ON THE PACKAGE. DO NOT TRANSLATE THEM. If multiple languages are present, prefer English, but keep raw spelling.";
    } else {
        translationInstruction = `TRANSLATE ALL INGREDIENT NAMES TO ${langName}.`;
    }

    let dietaryInstruction = "";
    if (dietaryPreferences && dietaryPreferences.length > 0) {
        dietaryInstruction = `
**DIETARY & ALLERGY CHECK:**
The user has the following dietary preferences/allergies: ${dietaryPreferences.join(", ")}.
If ANY ingredient violates these preferences (e.g., contains dairy for Dairy Allergy, contains meat for Vegan), you MUST add a clear warning message to the "warnings" array in ${langName}.
`;
    }

    let productContext = "food auditor";
    let notProductMessage = "This does not look like a food product or ingredients list. Please take a picture of the ingredients.";
    let rules = `
   - HALAL: Known permissible sources like Sugar, Tomatoes, Honey, Vegetables, Fruits, Grains, Natural Spices. ALL types of fish and marine animals (e.g., Anchovy, Tuna, Salmon, Sardine) are HALAL and do not require slaughtering.
   - DOUBTFUL: Ingredients with unspecified sources like Natural Flavor, Flavoring, Enzymes, Emulsifiers, Extracts (unspecified), Gelatin (unspecified), E471, Whey/Rennet (unspecified), Glycerin (unspecified). If an ingredient is a mixture of known HALAL and unspecified sources, classify it as DOUBTFUL, NOT HARAM.
   - HARAM: Clearly prohibited ingredients like Pork, Lard, Bacon, Alcohol/Ethanol, Wine, Beer, Rum, Gelatin (from pork), Carmine/E120, Shellac, L-Cysteine (human/hair).
   - IMPORTANT: Marine animals and fish like Anchovy are HALAL and do NOT require slaughtering. Never classify them as HARAM or DOUBTFUL based on slaughtering.
   - IMPORTANT: Do NOT classify any product as HARAM unless there is a clear, explicit HARAM ingredient.`;

    const systemInstruction = `
You are an expert Islamic ${productContext} (OCR & Analysis).

**CRITICAL: PRE-ANALYSIS IMAGE CHECKS**
Before analyzing ingredients/materials, check the image quality. If any of the following are true, STOP and return the specific status/reason immediately. The reason MUST be translated to ${langName}.

1. **Blurry/Unreadable**: If text is too blurry to extract confidently.
   -> Status: "DOUBTFUL", Reason: Translate this to ${langName}: "The image is unclear. For accurate results, please follow these tips:\n• Hold the camera steady.\n• Ensure good lighting without glare.\n• Focus clearly on the text.\n• Keep the text within the frame."
2. **Too Dark/Glare**: If lighting obscures the text.
   -> Status: "DOUBTFUL", Reason: Translate this to ${langName}: "Lighting is poor or there is glare on the text. For accurate results, please follow these tips:\n• Hold the camera steady.\n• Ensure good lighting without glare.\n• Focus clearly on the text.\n• Keep the text within the frame."
3. **Cut-off Text**: If the text is cut off or incomplete.
   -> Status: "DOUBTFUL", Reason: Translate this to ${langName}: "The text seems cut off. For accurate results, please follow these tips:\n• Hold the camera steady.\n• Ensure good lighting without glare.\n• Focus clearly on the text.\n• Keep the text within the frame."
4. **Not Food**: If the image is a person, car, scenery, cosmetics, clothing, or a random object with no context.
   -> Status: "NON_FOOD", Reason: Translate this to ${langName}: "${notProductMessage}"
5. **No Text Found**: If the image is clear but contains no readable text.
   -> Status: "DOUBTFUL", Reason: Translate this to ${langName}: "No readable text found. For accurate results, please follow these tips:\n• Hold the camera steady.\n• Ensure good lighting without glare.\n• Focus clearly on the text.\n• Keep the text within the frame."

**CRITICAL: INGREDIENTS VS MARKETING TEXT**
When analyzing product images, you MUST distinguish between:
1. The actual Ingredients list (usually preceded by "Ingredients:", "Contains:", "Made with:").
2. Marketing text, product descriptions, serving suggestions, or pairing ideas.

You MUST ONLY consider items as ingredients if they are part of the actual ingredients list.
If a food or meat name appears in:
- Product description
- Serving suggestion (Pairing)
- Marketing sentence
- Usage description
DO NOT consider it an ingredient.

Example: If the text says "Perfect for Wagyu beef" or "Formulated to be super gourmet for Wagyu beef", this means the product is meant to be eaten WITH Wagyu beef, NOT that it contains Wagyu beef. Ignore such text when extracting ingredients.
First locate words like "Ingredients", "Contains", or "Made with", and ONLY analyze the text that follows it as the ingredients list.

**ONLY IF IMAGE IS CLEAR:**
1. Extract ALL ingredient/material text.
2. ${translationInstruction}
3. Analyze against Halal standards.
4. Rules for Classification (Use ONLY HALAL, DOUBTFUL, or HARAM for the status field):${rules}
   - Compound Ingredients (e.g., "Worcestershire Sauce (Vinegar, Anchovy, Tamarind)"):
     - Extract the main ingredient and all its sub-ingredients.
     - Analyze each sub-ingredient separately.
     - The main compound ingredient's status depends on its sub-ingredients:
       - If all sub-ingredients are HALAL -> Compound is HALAL.
       - If any sub-ingredient is DOUBTFUL and no HARAM -> Compound is DOUBTFUL.
       - If any sub-ingredient is HARAM -> Compound is HARAM.
     - If a compound ingredient (like "Worcestershire Sauce", "Seasoning Mix", "Flavor Blend") is listed WITHOUT sub-ingredients, classify it as DOUBTFUL.
   - Ambiguous Sources:
     - If an ingredient can be derived from either plant or animal sources (e.g., E621 / flavor enhancers, emulsifiers, glycerin, gelatin) and the manufacturer does NOT explicitly state its source on the packaging, you MUST classify it as DOUBTFUL.
     - Do not assume it is plant-based unless explicitly stated.
     - If an ingredient is known and its source is clearly specified -> HALAL.
     - If an ingredient is clearly from a prohibited source -> HARAM.
     - If an ingredient can be from plant or animal and source is not specified -> DOUBTFUL.
   - Final Product Status:
     - If all items are HALAL -> Status: HALAL
     - If there is at least one DOUBTFUL item and NO HARAM items -> Status: DOUBTFUL
     - If there is at least one HARAM item -> Status: HARAM
${dietaryInstruction}

**CRITICAL: DESCRIPTIVE REASONS**
When providing the "reason" for the overall product or individual ingredients, DO NOT use direct religious rulings like "Halal" or "Haram". Instead, use descriptive, informative language.
- Instead of "Halal", say "No forbidden ingredients found" or "Plant-based/Synthetic source".
- Instead of "Haram", say "Contains forbidden ingredients" or "Derived from prohibited sources".
- Instead of "Doubtful", say "Source unspecified" or "Could be from plant or animal sources".

Output: JSON ONLY. No Markdown.
"ingredientsDetected": List ingredients/materials based on the translation instruction. Include "subIngredients" array if it's a compound ingredient.
"reason": Provide the descriptive reason in ${langName} without using the words Halal or Haram.
"warnings": Array of strings containing health/allergy warnings in ${langName} (if applicable).
`;

    const parts = [];

    if (images && Array.isArray(images) && images.length > 0) {
        images.forEach(img => {
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: img
                }
            });
        });
    }

    if (text) {
        parts.push({ text: `Analysis Request: Please evaluate this ingredient list: \n${text}` });
    }

    // Explicitly request JSON structure in the prompt as well to reinforce the schema
    parts.push({ text: "Return valid JSON object strictly matching the schema. No markdown." });

    if (parts.length <= 1) { 
         return response.status(400).json({ error: 'No content provided' });
    }

    const modelResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: { parts: parts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
             type: Type.OBJECT,
             properties: {
               status: { type: Type.STRING },
               reason: { type: Type.STRING },
               ingredientsDetected: { 
                 type: Type.ARRAY, 
                 items: { 
                    type: Type.OBJECT, 
                    properties: { 
                        name: {type: Type.STRING}, 
                        status: {type: Type.STRING},
                        subIngredients: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: {type: Type.STRING},
                                    status: {type: Type.STRING}
                                }
                            }
                        }
                    }
                 } 
               },
               confidence: { type: Type.INTEGER },
               warnings: {
                 type: Type.ARRAY,
                 items: { type: Type.STRING }
               }
             }
        }
      },
    });

    if (!modelResponse || !modelResponse.text) {
        throw new Error("Empty response from AI");
    }

    let result;
    try {
        // Double cleanup just in case Gemini sends markdown despite instructions
        const cleanText = modelResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanText);
    } catch (e) {
        console.warn("Failed to parse AI response:", modelResponse.text);
        // Fallback result instead of 500 error
        const fallbackMessages = {
            ar: "حدث خطأ في قراءة الاستجابة. يرجى المحاولة مرة أخرى.",
            fr: "Erreur lors de l'analyse de la réponse IA. Veuillez réessayer.",
            id: "Kesalahan saat mengurai respons AI. Silakan coba lagi.",
            tr: "Yapay zeka yanıtı ayrıştırılırken hata oluştu. Lütfen tekrar deneyin.",
            de: "Fehler beim Parsen der KI-Antwort. Bitte versuchen Sie es erneut.",
            ru: "Ошибка при разборе ответа ИИ. Попробуйте снова.",
            ur: "AI جواب کو پارس کرنے میں خرابی۔ براہ کرم دوبارہ کوشش کریں۔",
            ms: "Ralat menghuraikan respons AI. Sila cuba lagi.",
            bn: "এআই প্রতিক্রিয়া পার্স করতে ত্রুটি। অনুগ্রহ করে আবার চেষ্টা করুন.",
            zh: "解析 AI 响应时出错。请重试。",
            fa: "خطا در تجزیه پاسخ هوش مصنوعی. لطفا دوباره تلاش کنید.",
            es: "Error al analizar la respuesta de IA. Por favor intenta de nuevo.",
            hi: "AI प्रतिक्रिया को पार्स करने में त्रुटि। कृपया पुनः प्रयास करें।",
            uz: "AI javobini tahlil qilishda xatolik. Iltimos, qayta urinib ko'ring.",
            kk: "AI жауабын талдау қатесі. Қайта көріңіз.",
            ky: "AI жообун талдоо катасы. Сураныч, кайра аракет кылыңыз.",
            so: "Khalad falanqaynta jawaabta AI. Fadlan isku day mar kale.",
            ha: "Kuskure wajen fassarar amsar AI. Da fatan za a sake gwadawa.",
            sw: "Hitilafu wakati wa kuchakata jibu la AI. Tafadhali jaribu tena.",
            ps: "د AI ځواب په پروسس کولو کې تېروتنه. مهرباني وکړئ بیا هڅه وکړئ.",
            tl: "Error sa pag-parse ng tugon ng AI. Pakisubukan muli.",
            ku: "هەڵە لە شیکردنەوەی وەڵامی AI. تکایە دووبارە هەوڵبدەرەوە.",
            ml: "AI പ്രതികരണം പാഴ്‌സ് ചെയ്യുന്നതിൽ പിശക്. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
            en: "Error parsing AI response. Please try again."
        };
        
        result = { 
            status: "DOUBTFUL", 
            reason: fallbackMessages[language] || fallbackMessages['en'],
            ingredientsDetected: [], 
            confidence: 0 
        };
    }

    // Increment scan count 
    if (userId && userId !== 'anonymous' && supabase) {
       try {
           await supabase.rpc('increment_scan_count', { row_id: userId });
       } catch (statsErr) {
           console.error("Failed to update stats", statsErr);
       }
    }

    return response.status(200).json(result);

  } catch (error) {
    console.error("Backend Error:", error);

    if (error.message?.toLowerCase().includes('safety') || error.message?.toLowerCase().includes('blocked') || error.message?.toLowerCase().includes('harm')) {
         const safetyMessages = {
             ar: "تم حظر المحتوى لأسباب تتعلق بالسلامة. يرجى التقاط صورة أخرى.",
             fr: "Contenu bloqué pour des raisons de sécurité. Veuillez prendre une autre photo.",
             id: "Konten diblokir karena alasan keamanan. Silakan ambil foto lain.",
             tr: "İçerik güvenlik nedeniyle engellendi. Lütfen başka bir fotoğraf çekin.",
             en: "Content blocked for safety reasons. Please take another picture."
         };
         
         return response.status(200).json({
             status: "DOUBTFUL",
             reason: safetyMessages[language] || safetyMessages['en'],
             ingredientsDetected: [],
             confidence: 0
         });
    }

    // Handle Quota/Rate Limit Errors (429)
    if (error.message?.includes('429') || error.status === 429 || error.code === 429 || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('503') || error.status === 503 || error.code === 503 || error.message?.includes('500') || error.status === 500 || error.code === 500) {
         const busyMessages = {
            ar: "الخادم مشغول حالياً. يرجى المحاولة بعد قليل.",
            fr: "Le serveur est occupé. Veuillez réessayer plus tard.",
            id: "Server sedang sibuk. Silakan coba lagi nanti.",
            tr: "Sunucu şu anda meşgul. Lütfen daha sonra tekrar deneyin.",
            de: "Server ist beschäftigt. Bitte versuchen Sie es später erneut.",
            ru: "Сервер перегружен. Попробуйте позже.",
            ur: "سرور مصروف ہے۔ براہ کرم کچھ دیر بعد کوشش کریں۔",
            ms: "Pelayan sedang sibuk. Sila cuba sebentar lagi.",
            bn: "সার্ভার বর্তমানে ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
            zh: "服务器繁忙。请稍后再试。",
            fa: "سرور مشغول است. لطفا کمی بعد تلاش کنید.",
            es: "El servidor está ocupado. Inténtalo más tarde.",
            hi: "सर्वर व्यस्त है। कृपया थोड़ी देर बाद प्रयास करें।",
            uz: "Server band. Iltimos, keyinroq urinib ko'ring.",
            kk: "Сервер бос емес. Кейінірек қайталаңыз.",
            ky: "Сервер бош эмес. Бираздан кийин аракет кылыңыз.",
            so: "Server-ku wuu mashquulsan yahay. Fadlan isku day mar kale hadhow.",
            ha: "Sabara tana aiki. Da fatan za a sake gwadawa anjima.",
            sw: "Seva ina shughuli nyingi. Tafadhali jaribu tena baadaye.",
            ps: "سرور بوخت دی. مهرباني وکړئ وروسته بیا هڅه وکړئ.",
            tl: "Abala ang server. Pakisubukan muli mamaya.",
            ku: "سێرڤەر سەرقاڵە. تکایە دواتر هەوڵبدەرەوە.",
            ml: "സെർവർ തിരക്കിലാണ്. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക.",
            en: "Server is busy. Please try again later."
         };
         
         return response.status(200).json({
             status: "DOUBTFUL",
             reason: busyMessages[language] || busyMessages['en'],
             ingredientsDetected: [],
             confidence: 0
         });
    }

    return response.status(500).json({ 
        error: 'Internal Server Error', 
        details: error.message
    });
  }
}
    