import { executeWithKeyPool } from '../gemini.js';
import { getSetting } from '../db.js';

const DEFAULT_IMAGE_MODEL = 'gemini-2.0-flash-exp-image-generation';

export async function generateWithGemini({ referenceImage, prompt, tenantId }) {
  return executeWithKeyPool(1, async (apiKey) => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    let model_name = DEFAULT_IMAGE_MODEL;
    try {
      const setting = await getSetting('product_photo_gemini_model');
      if (setting) model_name = setting;
    } catch (e) {}
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: model_name,
      generationConfig: { responseModalities: ['image', 'text'] }
    });
    
    const parts = [{ text: prompt }];
    
    if (referenceImage && referenceImage.startsWith('data:')) {
      const [header, data] = referenceImage.split(',');
      const mimeMatch = header.match(/:(.*?);/);
      if (mimeMatch) {
        parts.push({ inlineData: { data, mimeType: mimeMatch[1] } });
      }
    }
    
    const result = await model.generateContent(parts);
    const imagePart = result.response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart) throw new Error('Gemini response tidak mengandung image. Model mungkin tidak mendukung image output.');
    
    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    return { mode: 'sync', provider: 'gemini', imageBuffer, mimeType: imagePart.inlineData.mimeType };
  });
}
