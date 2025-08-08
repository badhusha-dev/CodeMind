import { GoogleGenAI } from "@google/genai";
import { GitService } from "./git";
import * as path from "path";

export interface NewMessage {
  chatId: string;
  role: "user" | "assistant";
  content: string;
}

export interface AICodeOperation {
  type: "refactor" | "add_feature" | "fix_bugs" | "write_docs" | "analyze";
  files: string[];
  description: string;
  repository?: string;
}

export interface AICodeResult {
  success: boolean;
  changes: FileChange[];
  summary: string;
  error?: string;
}

export interface FileChange {
  path: string;
  content: string;
  isNew: boolean;
  language?: string;
}

export async function performAICodeOperation(
  operation: AICodeOperation,
  apiKey: string,
  gitService?: GitService
): Promise<AICodeResult> {
  try {
    const genAI = new GoogleGenAI({ apiKey });
    
    // Read existing files if available
    const fileContents: Record<string, string> = {};
    if (gitService && operation.files.length > 0) {
      for (const filePath of operation.files) {
        const content = await gitService.readFile(filePath);
        if (content !== null) {
          fileContents[filePath] = content;
        }
      }
    }

    const systemPrompt = getSystemPromptForOperation(operation.type);
    const userPrompt = buildUserPrompt(operation, fileContents);

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            changes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  content: { type: "string" },
                  isNew: { type: "boolean" },
                  language: { type: "string" },
                },
                required: ["path", "content", "isNew"],
              },
            },
            summary: { type: "string" },
          },
          required: ["changes", "summary"],
        },
      },
      contents: userPrompt,
    });

    const result = JSON.parse(response.text || "{}");
    
    return {
      success: true,
      changes: result.changes || [],
      summary: result.summary || "AI operation completed",
    };
  } catch (error) {
    console.error("AI code operation error:", error);
    return {
      success: false,
      changes: [],
      summary: "Failed to perform AI operation",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function getSystemPromptForOperation(type: string): string {
  const basePrompt = `You are an expert software engineer and code assistant. You help developers by analyzing, modifying, and improving their code.`;
  
  switch (type) {
    case "refactor":
      return `${basePrompt} Your task is to refactor code to improve readability, maintainability, and performance while preserving functionality. Follow best practices and modern coding standards.`;
    
    case "add_feature":
      return `${basePrompt} Your task is to add new features to existing code. Ensure the new feature integrates well with the existing codebase and follows the same patterns and conventions.`;
    
    case "fix_bugs":
      return `${basePrompt} Your task is to identify and fix bugs in the provided code. Analyze the code carefully and provide fixes that resolve issues while maintaining code quality.`;
    
    case "write_docs":
      return `${basePrompt} Your task is to write comprehensive documentation for the provided code. Include function/class descriptions, parameter documentation, usage examples, and inline comments.`;
    
    case "analyze":
      return `${basePrompt} Your task is to analyze the provided code and suggest improvements. Identify potential issues, performance bottlenecks, security concerns, and opportunities for optimization.`;
    
    default:
      return basePrompt;
  }
}

function buildUserPrompt(operation: AICodeOperation, fileContents: Record<string, string>): string {
  let prompt = `Operation: ${operation.type}\nDescription: ${operation.description}\n\n`;
  
  if (Object.keys(fileContents).length > 0) {
    prompt += "Current files:\n\n";
    for (const [filePath, content] of Object.entries(fileContents)) {
      prompt += `File: ${filePath}\n\`\`\`\n${content}\n\`\`\`\n\n`;
    }
  }
  
  prompt += `Please provide the updated/new files as a JSON response with the following structure:
{
  "changes": [
    {
      "path": "relative/path/to/file",
      "content": "complete file content",
      "isNew": true/false,
      "language": "javascript/python/etc"
    }
  ],
  "summary": "Brief description of changes made"
}`;

  return prompt;
}

export async function generateCommitMessage(
  changes: string[],
  apiKey: string
): Promise<string> {
  try {
    const genAI = new GoogleGenAI({ apiKey });
    
    const prompt = `Generate a clear, concise commit message for the following changes:

${changes.join('\n')}

Follow conventional commit format (feat:, fix:, docs:, refactor:, etc.) and keep it under 72 characters for the first line. If needed, add a longer description after a blank line.`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "Update files";
  } catch (error) {
    console.error("Error generating commit message:", error);
    return "Update files";
  }
}

export async function generateProject(
  userMessage: string,
  apiKey: string
): Promise<string> {
  try {
    const genAI = new GoogleGenAI({ apiKey });
    
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-pro",
      contents: userMessage,
    });

    return response.text || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Error generating project response:", error);
    return "I encountered an error while processing your request. Please check your API key and try again.";
  }
}

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".py": "python",
    ".java": "java",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".c": "c",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".sh": "bash",
    ".ps1": "powershell",
    ".sql": "sql",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".less": "less",
    ".json": "json",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".dockerfile": "dockerfile",
  };
  
  return languageMap[ext] || "text";
}