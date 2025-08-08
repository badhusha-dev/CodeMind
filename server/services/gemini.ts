import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || "" 
});

export interface GeminiResponse {
  content: string;
  error?: string;
}

export async function generateCodeResponse(
  prompt: string,
  apiKey?: string
): Promise<GeminiResponse> {
  try {
    const genAI = apiKey ? new GoogleGenAI({ apiKey }) : ai;
    
    const systemPrompt = `You are an expert coding assistant. You help users with:
- Code generation in any programming language or framework
- Debugging and fixing code errors
- Explaining complex programming concepts
- Code review and optimization suggestions

Always provide clear, well-commented code examples with explanations.
Format code blocks using markdown with proper language tags.
Detect the programming language or framework the user wants to work with from their message.
Be helpful, accurate, and educational in your responses.`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const content = response.text || "I apologize, but I couldn't generate a response. Please try again.";
    
    return { content };
  } catch (error) {
    console.error("Gemini API error:", error);
    return { 
      content: "I encountered an error while processing your request. Please check your API key and try again.",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const genAI = new GoogleGenAI({ apiKey });
    
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello",
    });

    return !!response.text;
  } catch (error) {
    console.error("API key validation error:", error);
    return false;
  }
}
