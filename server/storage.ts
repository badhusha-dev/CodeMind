import { type Chat, type Message, type InsertChat, type InsertMessage, type User, type InsertUser, type Repository, type InsertRepository, type WorkspaceFile, type InsertWorkspaceFile } from "@shared/schema";
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
  
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByGithubId(githubId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  
  // Repository operations
  getRepositories(userId: string): Promise<Repository[]>;
  getRepository(id: string): Promise<Repository | undefined>;
  createRepository(repository: InsertRepository): Promise<Repository>;
  updateRepository(id: string, updates: Partial<InsertRepository>): Promise<Repository | undefined>;
  deleteRepository(id: string): Promise<boolean>;
  
  // Workspace file operations
  getWorkspaceFiles(repositoryId?: string): Promise<WorkspaceFile[]>;
  getWorkspaceFile(id: string): Promise<WorkspaceFile | undefined>;
  getWorkspaceFileByPath(path: string, repositoryId?: string): Promise<WorkspaceFile | undefined>;
  createWorkspaceFile(file: InsertWorkspaceFile): Promise<WorkspaceFile>;
  updateWorkspaceFile(id: string, updates: Partial<InsertWorkspaceFile>): Promise<WorkspaceFile | undefined>;
  deleteWorkspaceFile(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private chats: Map<string, Chat>;
  private messages: Map<string, Message>;
  private users: Map<string, User>;
  private repositories: Map<string, Repository>;
  private workspaceFiles: Map<string, WorkspaceFile>;

  constructor() {
    this.chats = new Map();
    this.messages = new Map();
    this.users = new Map();
    this.repositories = new Map();
    this.workspaceFiles = new Map();
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

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByGithubId(githubId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.githubId === githubId);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = { 
      ...insertUser,
      email: insertUser.email || null,
      githubId: insertUser.githubId || null,
      avatarUrl: insertUser.avatarUrl || null,
      accessToken: insertUser.accessToken || null,
      id, 
      createdAt: now
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...updates,
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Repository operations
  async getRepositories(userId: string): Promise<Repository[]> {
    return Array.from(this.repositories.values())
      .filter(repo => repo.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getRepository(id: string): Promise<Repository | undefined> {
    return this.repositories.get(id);
  }

  async createRepository(insertRepository: InsertRepository): Promise<Repository> {
    const id = randomUUID();
    const now = new Date();
    const repository: Repository = { 
      ...insertRepository,
      description: insertRepository.description || null,
      private: insertRepository.private || false,
      defaultBranch: insertRepository.defaultBranch || "main",
      isCloned: insertRepository.isCloned || false,
      localPath: insertRepository.localPath || null,
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.repositories.set(id, repository);
    return repository;
  }

  async updateRepository(id: string, updates: Partial<InsertRepository>): Promise<Repository | undefined> {
    const repository = this.repositories.get(id);
    if (!repository) return undefined;
    
    const updatedRepository: Repository = {
      ...repository,
      ...updates,
      updatedAt: new Date(),
    };
    this.repositories.set(id, updatedRepository);
    return updatedRepository;
  }

  async deleteRepository(id: string): Promise<boolean> {
    const deleted = this.repositories.delete(id);
    if (deleted) {
      // Also delete all workspace files for this repository
      const filesToDelete = Array.from(this.workspaceFiles.entries())
        .filter(([, file]) => file.repositoryId === id);
      filesToDelete.forEach(([fileId]) => {
        this.workspaceFiles.delete(fileId);
      });
    }
    return deleted;
  }

  // Workspace file operations
  async getWorkspaceFiles(repositoryId?: string): Promise<WorkspaceFile[]> {
    let files = Array.from(this.workspaceFiles.values());
    if (repositoryId) {
      files = files.filter(file => file.repositoryId === repositoryId);
    }
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  async getWorkspaceFile(id: string): Promise<WorkspaceFile | undefined> {
    return this.workspaceFiles.get(id);
  }

  async getWorkspaceFileByPath(path: string, repositoryId?: string): Promise<WorkspaceFile | undefined> {
    return Array.from(this.workspaceFiles.values())
      .find(file => file.path === path && (!repositoryId || file.repositoryId === repositoryId));
  }

  async createWorkspaceFile(insertFile: InsertWorkspaceFile): Promise<WorkspaceFile> {
    const id = randomUUID();
    const now = new Date();
    const file: WorkspaceFile = {
      ...insertFile,
      content: insertFile.content || null,
      repositoryId: insertFile.repositoryId || null,
      language: insertFile.language || null,
      isModified: insertFile.isModified || false,
      isTracked: insertFile.isTracked || true,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.workspaceFiles.set(id, file);
    return file;
  }

  async updateWorkspaceFile(id: string, updates: Partial<InsertWorkspaceFile>): Promise<WorkspaceFile | undefined> {
    const file = this.workspaceFiles.get(id);
    if (!file) return undefined;
    
    const updatedFile: WorkspaceFile = {
      ...file,
      ...updates,
      updatedAt: new Date(),
    };
    this.workspaceFiles.set(id, updatedFile);
    return updatedFile;
  }

  async deleteWorkspaceFile(id: string): Promise<boolean> {
    return this.workspaceFiles.delete(id);
  }
}

export const storage = new MemStorage();
