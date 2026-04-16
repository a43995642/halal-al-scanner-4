
// Vercel Serverless Function
// This runs on the server. The API Key is SAFE here.

import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

// Configuration from Environment Variables
// We'll use the client config since we just need to read/write to Firestore.
// Note: In a real production environment, you'd use firebase-admin with a service account
// to bypass security rules. Here we assume the server has access or we use a specific auth.
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0173002338",
  appId: process.env.FIREBASE_APP_ID || "1:169103756685:web:e0df3273bac058b49f41c4",
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCZxgtoCFDTbVt6Kil-IwsvylSHywb6Gdg",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "gen-lang-client-0173002338.firebaseapp.com",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "gen-lang-client-0173002338.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "169103756685",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
};

// MINIMUM ALLOWED VERSION
const MIN_APP_VERSION = "2.2.0";

let db;
try {
    const app = initializeApp(firebaseConfig);
    const databaseId = process.env.FIREBASE_DATABASE_ID || "ai-studio-02964cf0-58a8-4cf7-bb15-c51b69cf1fac";
    db = getFirestore(app, databaseId);
} catch (e) {
    console.error("Failed to init Firebase client:", e);
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
    const appVersion = request.headers['x-app-version'];
    
    if (!appVersion || appVersion < MIN_APP_VERSION) {
        return response.status(426).json({ 
            error: 'UPDATE_REQUIRED', 
            message: 'updateRequired',
            reason: 'updateRequired'
        });
    }
    // -------------------------

    const { images, text, dietaryPreferences: bodyDietaryPrefs, isPremium: bodyIsPremium } = request.body;
    const userId = request.headers['x-user-id'];
    const language = request.headers['x-language'] || 'ar'; 
    const ingredientMode = request.headers['x-ingredient-language'] || 'app'; 
    
    const dietaryPrefsHeader = request.headers['x-dietary-preferences'];
    let dietaryPreferences = bodyDietaryPrefs || [];
    if (!bodyDietaryPrefs && dietaryPrefsHeader) {
        try {
            dietaryPreferences = JSON.parse(dietaryPrefsHeader);
        } catch(e) {}
    }
    
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("Server missing API Key");
      return response.status(500).json({ 
        error: 'CONFIGURATION_ERROR', 
        message: 'Missing Google API Key in environment.' 
      });
    }

    // Check User Stats
    if (userId && userId !== 'anonymous' && db) {
        try {
            const docRef = doc(db, 'user_stats', userId);
            const docSnap = await getDoc(docRef);
            
            let currentCount = 0;
            let isPremium = bodyIsPremium !== undefined ? bodyIsPremium : (request.headers['x-is-premium'] === 'true');

            if (docSnap.exists()) {
                const userStats = docSnap.data();
                currentCount = userStats.scan_count || 0;
                isPremium = isPremium || userStats.is_premium;
            } 
            
            if (!isPremium && currentCount >= 3) {
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
   - IMPORTANT: Do NOT classify any product as HARAM unless there is a clear, explicit HARAM ingredient.
   - IMPORTANT - MEAT & POULTRY: Any meat or poultry ingredient (e.g., Beef, Chicken, Lamb, Meat Extract, Chicken Broth, Animal Fat) MUST be classified as DOUBTFUL unless the packaging explicitly states it is "Halal Certified" or "Zabiha". Do not assume meat is Halal or Haram without explicit certification or source information.
   - RULE TAGGING: You MUST assign a specific "rule_id" to EVERY ingredient based on why it received its status. Choose from: "RULE_HALAL_NATURAL", "RULE_HALAL_MARINE", "RULE_HARAM_PORK", "RULE_HARAM_ALCOHOL", "RULE_HARAM_INSECTS", "RULE_DOUBTFUL_UNSPECIFIED", "RULE_DOUBTFUL_MEAT", "RULE_OTHER".`;

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

    parts.push({ text: "Return valid JSON object strictly matching the schema. No markdown." });

    if (parts.length <= 1) { 
         return response.status(400).json({ error: 'No content provided' });
    }

    let modelResponse;
    let retries = 3;
    let delay = 1000; // Start with 1 second delay

    for (let i = 0; i < retries; i++) {
        try {
            modelResponse = await ai.models.generateContent({
              // Using gemini-2.5-flash as it is more stable and less prone to rate limits than preview models
              model: "gemini-2.5-flash",
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
                                rule_id: {type: Type.STRING},
                                subIngredients: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: {type: Type.STRING},
                                            status: {type: Type.STRING},
                                            rule_id: {type: Type.STRING}
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
            break; // Success, exit loop
        } catch (err) {
            const isRetryable = err.message?.includes('429') || err.status === 429 || err.code === 429 || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('503') || err.status === 503 || err.code === 503 || err.message?.includes('500') || err.status === 500 || err.code === 500;
            
            if (isRetryable && i < retries - 1) {
                console.warn(`Gemini API busy, retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            } else {
                throw err; // Re-throw if not retryable or out of retries
            }
        }
    }

    if (!modelResponse || !modelResponse.text) {
        throw new Error("Empty response from AI");
    }

    let result;
    try {
        const cleanText = modelResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanText);

        // --- AI HALLUCINATION OVERRIDE (LOCAL DATABASE) ---
        if (result && result.ingredientsDetected && Array.isArray(result.ingredientsDetected)) {
            let hasHaram = false;
            let hasDoubtful = false;

            const haramRegex = /\b(e120|carmine|cochineal|carminic acid|pork|lard|bacon|ham|porcine|swine|ethanol|wine|beer|rum|liquor|liqueur|brandy|cognac|tequila|vodka|whiskey|gin|champagne|sake|mirin|e904|shellac|confectioner's glaze|pork fat|pork gelatin)\b/i;
            
            const doubtfulRegex = /\b(e153|e160a|e252|e270|e322|e325|e326|e327|e422|e430|e431|e432|e433|e434|e435|e436|e441|e442|e470|e470a|e470b|e471|e472[a-f]?|e473|e474|e475|e476|e477|e478|e479b?|e481|e482|e483|e491|e492|e493|e494|e495|e542|e570|e572|e627|e631|e635|e640|e920|e921|e1518|mono- and diglycerides|polyglycerol polyricinoleate|sodium stearoyl-2-lactylate|calcium stearoyl-2-lactylate|bone phosphate|stearic acid|magnesium stearate|disodium inosinate|disodium ribonucleotides|glycine|glyceryl triacetate|triacetin|rennet|whey|pepsin|lipase|enzymes|glycerin|glycerol|flavoring|natural flavor|artificial flavor|gelatin|gelatine|shortening|tallow|suet|animal fat|animal shortening|polysorbate|vanilla extract|l-cysteine|l-cistein|l-cystine)\b/i;

            const checkIngredient = (ing) => {
                if (!ing || !ing.name) return;
                
                if (haramRegex.test(ing.name)) {
                    ing.status = "HARAM";
                    hasHaram = true;
                    if (/pork|lard|bacon|ham|porcine|swine/i.test(ing.name)) ing.rule_id = "RULE_HARAM_PORK";
                    else if (/e120|carmine|cochineal|shellac/i.test(ing.name)) ing.rule_id = "RULE_HARAM_INSECTS";
                    else ing.rule_id = "RULE_HARAM_ALCOHOL";
                } else if (doubtfulRegex.test(ing.name) && ing.status !== "HARAM") {
                    ing.status = "DOUBTFUL";
                    ing.rule_id = "RULE_DOUBTFUL_UNSPECIFIED";
                    hasDoubtful = true;
                } else if (!ing.rule_id) {
                    ing.rule_id = "RULE_OTHER";
                }
                
                if (ing.subIngredients && Array.isArray(ing.subIngredients)) {
                    ing.subIngredients.forEach(subIng => checkIngredient(subIng));
                }
            };

            result.ingredientsDetected.forEach(ing => checkIngredient(ing));

            const overrideMessages = {
                HARAM: "overrideHaram",
                DOUBTFUL: "overrideDoubtful"
            };

            if (hasHaram && result.status !== "HARAM") {
                result.status = "HARAM";
                result.reason = overrideMessages.HARAM;
            } else if (hasDoubtful && result.status === "HALAL") {
                result.status = "DOUBTFUL";
                result.reason = overrideMessages.DOUBTFUL;
            }
        }
        // --------------------------------------------------

        // --- NEW SMART CLASSIFICATION SYSTEM INTEGRATION ---
        if (result && result.ingredientsDetected && Array.isArray(result.ingredientsDetected)) {
            const smartResult = analyzeIngredients(result.ingredientsDetected, language);
            
            const severity = { "HALAL": 0, "DOUBTFUL": 1, "HARAM": 2 };
            
            if (severity[smartResult.status] >= severity[result.status]) {
                result.status = smartResult.status;
                result.reason = smartResult.reason;
            } else if (result.status === "HALAL" && smartResult.status === "HALAL") {
                result.reason = smartResult.reason;
            }

            // --- AUTO-LEARNING CACHE SYSTEM (FIRESTORE) ---
            if (db) {
                try {
                    const namesToCache = new Set();
                    const extractNames = (ing) => {
                        if (ing.name && ing.name.length < 50) {
                            namesToCache.add(ing.name.toLowerCase().trim());
                        }
                        if (ing.subIngredients) ing.subIngredients.forEach(extractNames);
                    };
                    result.ingredientsDetected.forEach(extractNames);
                    const namesArray = Array.from(namesToCache);

                    if (namesArray.length > 0) {
                        const cacheMap = {};
                        
                        // Fetch existing from Firestore
                        // Note: Firestore 'in' queries are limited to 10 items.
                        // For simplicity, we'll just fetch them individually or in chunks of 10.
                        const chunks = [];
                        for (let i = 0; i < namesArray.length; i += 10) {
                            chunks.push(namesArray.slice(i, i + 10));
                        }
                        
                        for (const chunk of chunks) {
                            // In a real app we'd use a query with 'in', but since we're in a serverless function
                            // we can just fetch the documents directly if we use the name as the document ID.
                            // Let's assume the document ID is the ingredient name (sanitized).
                            for (const name of chunk) {
                                const safeId = encodeURIComponent(name).replace(/\./g, '%2E');
                                const docRef = doc(db, 'ingredient_cache', safeId);
                                const docSnap = await getDoc(docRef);
                                if (docSnap.exists()) {
                                    cacheMap[name] = docSnap.data();
                                }
                            }
                        }

                        const newToCache = [];

                        const applyCache = (ing) => {
                            if (!ing.name) return;
                            const nameLower = ing.name.toLowerCase().trim();
                            
                            if (cacheMap[nameLower]) {
                                const cachedData = cacheMap[nameLower];
                                if (severity[cachedData.status] >= severity[ing.status]) {
                                    ing.status = cachedData.status;
                                    if (cachedData.rule_id) ing.rule_id = cachedData.rule_id;
                                }
                            } else if (nameLower.length < 50) {
                                newToCache.push({ name: nameLower, status: ing.status, rule_id: ing.rule_id || "RULE_OTHER" });
                                cacheMap[nameLower] = { status: ing.status, rule_id: ing.rule_id || "RULE_OTHER" }; 
                            }

                            if (ing.subIngredients) ing.subIngredients.forEach(applyCache);
                        };

                        result.ingredientsDetected.forEach(applyCache);

                        // Save new ingredients to DB
                        if (newToCache.length > 0) {
                            for (const item of newToCache) {
                                const safeId = encodeURIComponent(item.name).replace(/\./g, '%2E');
                                const docRef = doc(db, 'ingredient_cache', safeId);
                                await setDoc(docRef, { name: item.name, status: item.status, rule_id: item.rule_id }, { merge: true });
                            }
                        }

                        let finalStatus = "HALAL";
                        let hasHaram = false;
                        let hasDoubtful = false;
                        
                        const checkFinal = (ing) => {
                            if (ing.status === "HARAM") hasHaram = true;
                            if (ing.status === "DOUBTFUL") hasDoubtful = true;
                            if (ing.subIngredients) ing.subIngredients.forEach(checkFinal);
                        }
                        result.ingredientsDetected.forEach(checkFinal);
                        
                        if (hasHaram) finalStatus = "HARAM";
                        else if (hasDoubtful) finalStatus = "DOUBTFUL";
                        
                        if (severity[finalStatus] > severity[result.status]) {
                            result.status = finalStatus;
                            const texts = {
                                HARAM: "smartHaram",
                                DOUBTFUL: "smartDoubtful"
                            };
                            result.reason = texts[finalStatus] || result.reason;
                        }
                    }
                } catch (cacheErr) {
                    console.error("Cache system error:", cacheErr);
                }
            }
            // ---------------------------------------------
        }
        // ---------------------------------------------------

    } catch (e) {
        console.warn("Failed to parse AI response:", modelResponse.text);
        
        result = { 
            status: "DOUBTFUL", 
            reason: "fallbackError",
            ingredientsDetected: [], 
            confidence: 0 
        };
    }

    // Increment scan count 
    if (userId && userId !== 'anonymous' && db) {
       try {
           const docRef = doc(db, 'user_stats', userId);
           await setDoc(docRef, { scan_count: increment(1) }, { merge: true });
       } catch (statsErr) {
           console.error("Failed to update stats", statsErr);
       }
    }

    return response.status(200).json(result);

  } catch (error) {
    console.error("Backend Error:", error);

    if (error.message?.toLowerCase().includes('safety') || error.message?.toLowerCase().includes('blocked') || error.message?.toLowerCase().includes('harm')) {
         
         return response.status(200).json({
             status: "DOUBTFUL",
             reason: "safetyBlocked",
             ingredientsDetected: [],
             confidence: 0
         });
    }

    if (error.message?.includes('429') || error.status === 429 || error.code === 429 || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('503') || error.status === 503 || error.code === 503 || error.message?.includes('500') || error.status === 500 || error.code === 500) {
         
         return response.status(200).json({
             status: "DOUBTFUL",
             reason: "serverBusy",
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

// --- SMART INGREDIENT CLASSIFICATION SYSTEM ---
function analyzeIngredients(ingredients, language) {
    let hasHaram = false;
    let hasUnknown = false;

    const haramList = ['alcohol', 'ethanol', 'pork', 'gelatin'];
    const unknownList = ['flavor', 'vanilla extract', 'glycerin', 'emulsifier', 'stabilizer', 'enzyme'];
    const safeList = ['water', 'sugar', 'salt', 'corn starch', 'vanilla powder'];

    const checkIng = (ing) => {
        if (!ing || !ing.name) return;
        const nameLower = ing.name.toLowerCase();
        
        let isHaram = false;
        for (const h of haramList) {
            if (nameLower.includes(h)) {
                if (h === 'gelatin' && nameLower.includes('halal')) {
                    continue; 
                }
                isHaram = true;
                break;
            }
        }

        let isUnknown = false;
        if (!isHaram) {
            for (const u of unknownList) {
                if (nameLower.includes(u)) {
                    isUnknown = true;
                    break;
                }
            }
        }

        let isSafe = false;
        if (!isHaram && !isUnknown) {
            for (const s of safeList) {
                if (nameLower.includes(s)) {
                    isSafe = true;
                    break;
                }
            }
        }

        if (isHaram) {
            ing.status = "HARAM";
            ing.rule_id = (nameLower.includes('alcohol') || nameLower.includes('ethanol')) ? "RULE_HARAM_ALCOHOL" : "RULE_HARAM_PORK";
            hasHaram = true;
        } else if (isUnknown) {
            if (ing.status !== "HARAM") {
                ing.status = "DOUBTFUL";
                ing.rule_id = "RULE_DOUBTFUL_UNSPECIFIED";
                hasUnknown = true;
            }
        } else if (isSafe) {
            if (ing.status !== "HARAM" && ing.status !== "DOUBTFUL") {
                ing.status = "HALAL";
                ing.rule_id = "RULE_HALAL_NATURAL";
            }
        } else {
            if (ing.status === "HARAM") hasHaram = true;
            if (ing.status === "DOUBTFUL") hasUnknown = true;
            if (!ing.rule_id) ing.rule_id = "RULE_OTHER";
        }

        if (ing.subIngredients && Array.isArray(ing.subIngredients)) {
            ing.subIngredients.forEach(sub => checkIng(sub));
        }
    };

    if (ingredients && Array.isArray(ingredients)) {
        ingredients.forEach(ing => checkIng(ing));
    }

    let finalStatus = "HALAL";
    if (hasHaram) finalStatus = "HARAM";
    else if (hasUnknown) finalStatus = "DOUBTFUL";

    const texts = {
        HARAM: "smartHaram",
        DOUBTFUL: "smartDoubtful",
        HALAL: "smartHalal"
    };

    return {
        status: finalStatus,
        reason: texts[finalStatus]
    };
}