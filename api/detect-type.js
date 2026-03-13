import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const systemInstruction = `
You are an AI assistant that classifies products from images.
Determine if the product in the image is Food, Cosmetics, or Clothes.
If it is none of these, or if you are unsure, classify it as Unknown.

Output JSON ONLY.
{
  "type": "food" | "cosmetics" | "clothes" | "unknown"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, ""),
            },
          },
          { text: "Classify this product." }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON:", text);
      throw new Error("Invalid JSON response");
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Detect Type Error:", error);
    return res.status(500).json({ error: "Failed to detect product type" });
  }
}
