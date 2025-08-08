import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || "" 
});

export interface GeminiResponse {
  content: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface ApiUsageStats {
  requestCount: number;
  totalTokens: number;
  lastRequestTime: Date;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}

// In-memory storage for API usage (in production, use Redis or database)
const apiUsageMap = new Map<string, ApiUsageStats>();

export async function generateCodeResponse(
  prompt: string,
  apiKey?: string
): Promise<GeminiResponse> {
  const keyToUse = apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  
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

    const startTime = Date.now();
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const content = response.text || "I apologize, but I couldn't generate a response. Please try again.";
    
    // Track API usage
    const inputTokens = estimateTokens(prompt + systemPrompt);
    const outputTokens = estimateTokens(content);
    const totalTokens = inputTokens + outputTokens;
    
    updateApiUsage(keyToUse, totalTokens);
    
    return { 
      content,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens
      }
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    
    // Still track failed requests
    updateApiUsage(keyToUse, 0);
    
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

function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  // This is an approximation since we don't have access to the actual tokenizer
  return Math.ceil(text.length / 4);
}

function updateApiUsage(apiKey: string, tokens: number): void {
  const keyHash = hashApiKey(apiKey);
  const existing = apiUsageMap.get(keyHash) || {
    requestCount: 0,
    totalTokens: 0,
    lastRequestTime: new Date(),
  };
  
  existing.requestCount += 1;
  existing.totalTokens += tokens;
  existing.lastRequestTime = new Date();
  
  // Estimate rate limits (Gemini Pro has generous limits)
  // These are rough estimates - actual limits may vary
  const now = new Date();
  const minutesSinceLastRequest = (now.getTime() - existing.lastRequestTime.getTime()) / (1000 * 60);
  
  // Rough rate limit estimation (adjust based on your tier)
  existing.rateLimitRemaining = Math.max(0, 60 - existing.requestCount); // ~60 requests per minute
  existing.rateLimitReset = new Date(now.getTime() + 60000); // Reset in 1 minute
  
  apiUsageMap.set(keyHash, existing);
}

function hashApiKey(apiKey: string): string {
  // Simple hash for privacy - in production use crypto.createHash
  return apiKey.slice(0, 8) + "..." + apiKey.slice(-4);
}

export function getApiUsage(apiKey: string): ApiUsageStats | null {
  const keyHash = hashApiKey(apiKey);
  return apiUsageMap.get(keyHash) || null;
}
