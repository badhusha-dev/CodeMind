import { type Chat, type Message, type InsertChat, type InsertMessage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Chat operations
  getChats(): Promise<Chat[]>;
  getChat(id: string): Promise<Chat | undefined>;
  createChat(chat: InsertChat): Promise<Chat>;
  updateChat(id: string, updates: Partial<InsertChat>): Promise<Chat | undefined>;
  deleteChat(id: string): Promise<boolean>;
  
  // Message operations
  getMessages(chatId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessages(chatId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private chats: Map<string, Chat>;
  private messages: Map<string, Message>;

  constructor() {
    this.chats = new Map();
    this.messages = new Map();
  }

  async getChats(): Promise<Chat[]> {
    return Array.from(this.chats.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getChat(id: string): Promise<Chat | undefined> {
    return this.chats.get(id);
  }

  async createChat(insertChat: InsertChat): Promise<Chat> {
    const id = randomUUID();
    const now = new Date();
    const chat: Chat = { 
      ...insertChat,
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.chats.set(id, chat);
    return chat;
  }

  async updateChat(id: string, updates: Partial<InsertChat>): Promise<Chat | undefined> {
    const chat = this.chats.get(id);
    if (!chat) return undefined;
    
    const updatedChat: Chat = {
      ...chat,
      ...updates,
      updatedAt: new Date(),
    };
    this.chats.set(id, updatedChat);
    return updatedChat;
  }

  async deleteChat(id: string): Promise<boolean> {
    const deleted = this.chats.delete(id);
    if (deleted) {
      // Also delete all messages for this chat
      await this.deleteMessages(id);
    }
    return deleted;
  }

  async getMessages(chatId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.chatId === chatId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
    };
    this.messages.set(id, message);
    
    // Update chat's updatedAt timestamp
    const chat = this.chats.get(insertMessage.chatId);
    if (chat) {
      await this.updateChat(chat.id, { title: chat.title });
    }
    
    return message;
  }

  async deleteMessages(chatId: string): Promise<boolean> {
    const messagesToDelete = Array.from(this.messages.entries())
      .filter(([, message]) => message.chatId === chatId);
    
    messagesToDelete.forEach(([id]) => {
      this.messages.delete(id);
    });
    
    return messagesToDelete.length > 0;
  }
}

export const storage = new MemStorage();
