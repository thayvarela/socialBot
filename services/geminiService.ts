
import { GoogleGenAI, Type } from "@google/genai";
import { Sentiment, PostIdea, Platform } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSentiment = async (text: string): Promise<Sentiment> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Classifique o sentimento deste comentário: "${text}"`,
      config: {
        systemInstruction: "Classifique apenas como 'positivo', 'neutro' ou 'negativo'. Responda em JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: { type: Type.STRING }
          },
          required: ["sentiment"]
        }
      }
    });
    const json = JSON.parse(response.text || "{}");
    return (json.sentiment?.toLowerCase() as Sentiment) || 'neutro';
  } catch (error) {
    return 'neutro';
  }
};

export const generatePostIdea = async (
  nicho: string, 
  platform: Platform, 
  mode: 'ai_generated' | 'web_search',
  format: 'image' | 'video',
  duration?: number
): Promise<PostIdea> => {
  try {
    // 1. Definição de Contexto por Formato/Plataforma
    let prompt = "";
    if (format === 'video') {
      prompt = `Gere um roteiro de vídeo estratégico para ${platform} de ${duration || 30} segundos sobre o nicho ${nicho}. 
      Inclua: Título impactante, Roteiro de Narração (Voiceover), Roteiro Visual (Cenas) e Texto de Overlay (Gancho).`;
    } else {
      prompt = `Gere uma ideia de postagem (Imagem Estática) viral para ${platform} no nicho ${nicho}. 
      Inclua: Título, Legenda, OverlayText e Sugestão Visual.`;
    }

    const textGen = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: `Você é um diretor de criação viral especializado em ${platform}. 
        Gere um JSON seguindo estritamente a estrutura.
        Para VÍDEOS: Foque no 'narratorScript' e 'overlayText' (Hook inicial).
        Para IMAGENS: Foque no 'script' visual e 'caption'.
        Se mode for 'web_search', descreva buscas para imagens/clipes reais.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            script: { type: Type.STRING },
            narratorScript: { type: Type.STRING },
            caption: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            cta: { type: Type.STRING },
            overlayText: { type: Type.STRING, description: "Texto de gancho que aparece na tela" },
            imageSearchPrompt: { type: Type.STRING }
          },
          required: ["title", "script", "caption", "hashtags", "cta", "overlayText"]
        }
      }
    });

    const baseData = JSON.parse(textGen.text || "{}");
    let imageUrl = "";
    let storyboard: PostIdea['storyboard'] = [];

    // 2. Lógica Visual (IA vs Web Search)
    if (mode === 'ai_generated' && format === 'image') {
      const imgResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `High quality ${platform} post, niche ${nicho}: ${baseData.title}. Aesthetic style.` }] },
        config: { imageConfig: { aspectRatio: platform === 'instagram' ? '1:1' : '9:16' } }
      });
      
      for (const part of imgResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    } else {
      // Busca na Web para referências ou storyboard de vídeo
      const searchResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Encontre URLs de imagens reais/referências para o nicho ${nicho}: ${baseData.imageSearchPrompt || baseData.title}`,
        config: { tools: [{ googleSearch: {} }] }
      });
      
      const chunk = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks?.[0];
      imageUrl = chunk?.web?.uri || "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop";

      if (format === 'video') {
        // Gera Storyboard para qualquer vídeo
        const actualDuration = duration || 30;
        storyboard = [
          { time: "00:00", description: "Cena de Abertura (Hook)", webUri: imageUrl },
          { time: `00:${Math.floor(actualDuration/2)}`, description: "Explicação/Conteúdo", webUri: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1000&auto=format&fit=crop" },
          { time: `00:${actualDuration}`, description: "Call to Action final", webUri: "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1000&auto=format&fit=crop" }
        ];
      }
    }

    return { 
      id: crypto.randomUUID(),
      ...baseData, 
      platform, 
      visualMode: mode, 
      imageUrl, 
      videoDuration: format === 'video' ? duration : undefined,
      storyboard
    };
  } catch (error) {
    console.error("Content Gen Error:", error);
    throw error;
  }
};

export const generateEngagementText = async (prompt: string, platform: Platform, type: 'comment' | 'direct'): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Crie um ${type === 'comment' ? 'comentário' : 'DM'} para ${platform} baseado no prompt: "${prompt}".`,
      config: {
        systemInstruction: "Seja humano, breve e use gírias leves da plataforma se apropriado.",
        temperature: 0.8
      }
    });
    return response.text?.trim() || "Ótimo post!";
  } catch (error) {
    return "Muito bom!";
  }
};
