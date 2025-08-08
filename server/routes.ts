import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatSchema, insertMessageSchema } from "@shared/schema";
import { generateCodeResponse, validateApiKey } from "./services/gemini";

export async function registerRoutes(app: Express): Promise<Server> {
  // Validate API key
  app.post("/api/validate-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ message: "API key is required" });
      }

      const isValid = await validateApiKey(apiKey);
      res.json({ valid: isValid });
    } catch (error) {
      res.status(500).json({ message: "Failed to validate API key" });
    }
  });

  // Get all chats
  app.get("/api/chats", async (req, res) => {
    try {
      const chats = await storage.getChats();
      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chats" });
    }
  });

  // Create new chat
  app.post("/api/chats", async (req, res) => {
    try {
      const validatedData = insertChatSchema.parse(req.body);
      const chat = await storage.createChat(validatedData);
      res.status(201).json(chat);
    } catch (error) {
      res.status(400).json({ message: "Invalid chat data" });
    }
  });

  // Get chat by ID
  app.get("/api/chats/:id", async (req, res) => {
    try {
      const chat = await storage.getChat(req.params.id);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat" });
    }
  });

  // Delete chat
  app.delete("/api/chats/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteChat(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete chat" });
    }
  });

  // Get messages for a chat
  app.get("/api/chats/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send message and get AI response
  app.post("/api/chats/:id/messages", async (req, res) => {
    try {
      const { content, apiKey } = req.body;
      const chatId = req.params.id;
      
      if (!content || !apiKey) {
        return res.status(400).json({ message: "Content and API key are required" });
      }

      // Get chat to determine language
      const chat = await storage.getChat(chatId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      // Create user message
      const userMessage = await storage.createMessage({
        chatId,
        role: "user",
        content,
      });

      // Generate AI response
      const aiResponse = await generateCodeResponse(content, chat.language, apiKey);
      
      // Create AI message
      const aiMessage = await storage.createMessage({
        chatId,
        role: "assistant",
        content: aiResponse.content,
      });

      // Update chat title if it's the first message
      if (content.length > 0) {
        const messages = await storage.getMessages(chatId);
        if (messages.length === 2) { // First user message and first AI response
          const title = content.length > 50 ? content.substring(0, 50) + "..." : content;
          await storage.updateChat(chatId, { title });
        }
      }

      res.json({ userMessage, aiMessage });
    } catch (error) {
      console.error("Error in message endpoint:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // Download chat as text file
  app.get("/api/chats/:id/download", async (req, res) => {
    try {
      const chat = await storage.getChat(req.params.id);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const messages = await storage.getMessages(req.params.id);
      
      let content = `Code AI Agent Chat Export\n`;
      content += `Chat Title: ${chat.title}\n`;
      content += `Language: ${chat.language}\n`;
      content += `Created: ${chat.createdAt.toLocaleString()}\n`;
      content += `\n${"=".repeat(50)}\n\n`;

      for (const message of messages) {
        const roleLabel = message.role === "user" ? "You" : "AI Assistant";
        content += `[${message.timestamp.toLocaleString()}] ${roleLabel}:\n`;
        content += `${message.content}\n\n`;
        content += "-".repeat(30) + "\n\n";
      }

      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="chat-${chat.id}.txt"`);
      res.send(content);
    } catch (error) {
      res.status(500).json({ message: "Failed to download chat" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
