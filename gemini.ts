
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AdibResponse {
  text: string;
  imageUrl?: string;
  groundingSources?: GroundingSource[];
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateAdibResponse = async (
  prompt: string, 
  history: { role: 'user' | 'assistant', content: string }[],
  mood?: string,
  imageConfig?: { data: string, mimeType: string },
  location?: { latitude: number, longitude: number }
): Promise<AdibResponse> => {
  try {
    const isDuelIntent = /duel boshla|o'yin boshla|duel o'ynaymiz|kimligimni top/i.test(prompt);
    const isParallelIntent = /parallel|o'xshashlik|qiyos|solishtir|jahon adabiyoti|farqi/i.test(prompt);
    const isImageGenIntent = /chizib ber|tasvirlab ber|vizual|rasmini yarat|image|draw/i.test(prompt);
    const isLocationQuery = /joylashuv|manzil|qayerda|restoran|kafe|muzey|xarita|masofa/i.test(prompt);
    const isNewsQuery = /yangilik|bugun|kecha|oxirgi|prezident|narx|ob-havo/i.test(prompt);
    
    let modelName = 'gemini-3-pro-preview';
    let tools: any[] = [];
    let toolConfig: any = undefined;

    // Decide model based on complexity and task
    if (isImageGenIntent) {
      modelName = 'gemini-2.5-flash-image';
    } else if (imageConfig || isDuelIntent || isParallelIntent) {
      modelName = 'gemini-3-pro-preview';
    } else if (isLocationQuery) {
      modelName = 'gemini-2.5-flash';
      tools = [{ googleMaps: {} }];
      if (location) {
        toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: location.latitude,
              longitude: location.longitude
            }
          }
        };
      }
    } else if (isNewsQuery) {
      modelName = 'gemini-3-flash-preview';
      tools = [{ googleSearch: {} }];
    } else if (prompt.length < 50 && history.length < 3) {
      modelName = 'gemini-2.5-flash-lite-latest';
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: imageConfig ? {
        parts: [
          { inlineData: { data: imageConfig.data, mimeType: imageConfig.mimeType } },
          { text: prompt || "Ushbu rasmni tahlil qiling." }
        ]
      } : [
        { role: 'user', parts: [{ text: SYSTEM_INSTRUCTION + (mood ? `\nKayfiyat: ${mood}` : '') }] },
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        tools: tools.length > 0 ? tools : undefined,
        toolConfig: toolConfig,
        temperature: (isDuelIntent || isParallelIntent || isImageGenIntent) ? 0.9 : 0.7,
        thinkingConfig: (modelName.includes('pro') || isParallelIntent) ? { thinkingBudget: 12000 } : undefined,
        imageConfig: isImageGenIntent ? { aspectRatio: "1:1" } : undefined
      }
    });

    let text = "";
    let imageUrl = "";
    const groundingSources: GroundingSource[] = [];

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) groundingSources.push({ title: chunk.web.title, uri: chunk.web.uri });
        else if (chunk.maps) groundingSources.push({ title: chunk.maps.title, uri: chunk.maps.uri });
      });
    }

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        } else if (part.text) {
          text += part.text;
        }
      }
    }

    return {
      text: text.trim() || (imageUrl ? "Tasvir yaratildi." : "Javob olib bo'lmadi."),
      imageUrl,
      groundingSources: groundingSources.length > 0 ? groundingSources : undefined
    };

  } catch (error) {
    console.error("Gemini Error:", error);
    return { text: "Texnik xatolik yuz berdi. Qayta urinib ko'ring." };
  }
};
