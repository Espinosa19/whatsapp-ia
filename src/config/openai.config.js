import OpenAI from 'openai';

let openai = null;

export function getOpenAIInstance() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    
    const config = {
      apiKey: process.env.OPENAI_API_KEY,
    };

    // Agregar project ID si está disponible
    if (process.env.OPENAI_PROJECT_ID) {
      config.defaultHeaders = {
        'OpenAI-Project': process.env.OPENAI_PROJECT_ID,
      };
    }

    openai = new OpenAI(config);
  }
  return openai;
}

export default getOpenAIInstance;
