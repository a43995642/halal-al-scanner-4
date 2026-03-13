import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const languages = ['fr', 'id', 'tr', 'de', 'ru', 'ur', 'ms', 'bn', 'zh', 'fa', 'es', 'hi', 'uz', 'kk', 'ky', 'so', 'ha', 'sw', 'ps', 'tl', 'ku', 'ml'];

const OFFLINE_DB = [
  {
    id: "E120",
    en: "Derived from the cochineal insect (Carmine), which is considered Haram by most scholars."
  },
  {
    id: "E471",
    en: "Doubtful: Can be derived from animal fats (pork or non-zabiha beef) or plant sources. Requires verification."
  },
  {
    id: "E441",
    en: "Doubtful: Gelatin can be from pork (Haram), non-zabiha beef, or plant/fish (Halal)."
  },
  {
    id: "PORK",
    en: "Contains pork or its derivatives, which is strictly Haram."
  },
  {
    id: "ALCOHOL",
    en: "Contains alcohol or intoxicants."
  },
  {
    id: "E904",
    en: "Doubtful: Insect secretions, scholars differ on its ruling."
  },
  {
    id: "E542",
    en: "Doubtful: Derived from animal bones, which may be non-zabiha or pork."
  },
  {
    id: "E920",
    en: "Doubtful: Can be derived from human hair, duck feathers, pig hair, or synthetically."
  },
  {
    id: "RENNET",
    en: "Doubtful: Enzymes often derived from calf or pig stomachs. Halal if microbial or plant-based."
  },
  {
    id: "E100",
    en: "Halal: Plant-based extract from turmeric."
  },
  {
    id: "E160a",
    en: "Halal: Plant-based or synthetically produced."
  },
  {
    id: "E322",
    en: "Doubtful: Usually from soy (Halal), but can be from egg yolk or animal fats."
  },
  {
    id: "E422",
    en: "Doubtful: Can be from plant sources (Halal) or animal fats (Doubtful/Haram)."
  },
  {
    id: "E472",
    en: "Doubtful: Derivatives of E471, can be from animal or plant sources."
  },
  {
    id: "E481",
    en: "Doubtful: May contain stearic acid which can be of animal origin."
  },
  {
    id: "E621",
    en: "Halal: Flavor enhancer usually made from fermenting starch or sugar cane."
  }
];

async function translate() {
  const translations = {};
  
  for (const item of OFFLINE_DB) {
    translations[item.id] = {};
    
    const prompt = `Translate the following text into the following languages. Return ONLY a valid JSON object where keys are the language codes and values are the translated strings. Do not include markdown formatting like \`\`\`json.
    
Text to translate: "${item.en}"

Languages: ${languages.join(', ')}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      const result = JSON.parse(response.text);
      translations[item.id] = result;
      console.log(`Translated ${item.id}`);
    } catch (e) {
      console.error(`Failed for ${item.id}`, e);
    }
  }
  
  fs.writeFileSync('translations.json', JSON.stringify(translations, null, 2));
  console.log('Done!');
}

translate();
