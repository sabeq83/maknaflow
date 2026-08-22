import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('dummy_key');
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  systemInstruction: 'You are a test assistant.',
  generationConfig: { temperature: 0.7 }
});

console.log('Model keys:', Object.keys(model));
console.log('Model systemInstruction:', model.systemInstruction);
console.log('Model properties:', JSON.stringify(model, null, 2));
