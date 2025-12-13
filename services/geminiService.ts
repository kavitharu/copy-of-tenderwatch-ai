import { GoogleGenAI, Type } from "@google/genai";
import { TARGET_KEYWORDS } from "../constants";

// Schema for the expected output from Gemini
const tenderSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "The title of the tender in English." },
      originalLanguage: { type: Type.STRING, description: "The language detected (e.g., Dhivehi, English)." },
      url: { type: Type.STRING, description: "The full absolute URL to the tender details or PDF file." },
      dateString: { type: Type.STRING, description: "The date of the tender announcement found on page (e.g. 2024-05-20)." },
      keywordsFound: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "List of keywords from the target list found in this tender." 
      },
      snippet: { type: Type.STRING, description: "A brief summary or context where the keyword appeared, translated to English." }
    },
    required: ["title", "url", "keywordsFound", "snippet"]
  }
};

/**
 * Analyzes content using Gemini.
 * @param content The HTML/Text content.
 * @param baseUrl Base URL for link resolution.
 * @param siteName Name of the site.
 * @param apiKey The Gemini API Key (passed dynamically to support both Client and Server environments).
 */
export const analyzeSiteContent = async (
  content: string, 
  baseUrl: string,
  siteName: string,
  apiKey: string
) => {
  if (!apiKey) {
    console.error("Missing API Key for Gemini Analysis");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const model = "gemini-2.0-flash";
  
  // Calculate date range for filtering (Last 30 Days)
  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 30);
  
  const todayStr = today.toISOString().split('T')[0];
  const pastDateStr = pastDate.toISOString().split('T')[0];

  const prompt = `
    You are an intelligent tender scraping bot.
    
    1. Analyze the provided content from the website "${siteName}".
    2. Base URL: ${baseUrl}.
    3. DATE FILTERING RULE: 
       - Current Date: ${todayStr}
       - Cutoff Date: ${pastDateStr} (30 days ago)
       - Look for dates associated with the tender announcements.
       - STRICTLY EXCLUDE any tenders dated before ${pastDateStr}.
       - If a tender has NO detected date, INCLUDE it (safety margin).
       - If the content lists "expired" or "closed" tenders, ignore them.
       
    4. KEYWORD FILTERING:
       - Filter strictly for: ${TARGET_KEYWORDS.join(", ")}.
    
    5. TRANSLATION:
       - Translate Dhivehi/Sinhala content to English.
    
    6. OUTPUT:
       - Return a JSON array of matching, up-to-date tenders.
    
    Content Snippet:
    ${content.substring(0, 95000)} 
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: tenderSchema,
        temperature: 0.1
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text);

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return [];
  }
};