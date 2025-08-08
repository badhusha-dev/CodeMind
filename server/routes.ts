import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertChatSchema, insertMessageSchema, insertUserSchema, insertRepositorySchema, insertWorkspaceFileSchema } from "@shared/schema";
import { generateCodeResponse, validateApiKey } from "./services/gemini";
import { getGitHubAuthUrl, exchangeCodeForToken, getGitHubUser, getGitHubRepositories, getRepositoryContents, getFileContent } from "./services/github";
import { GitService } from "./services/git";
import { performAICodeOperation, generateCommitMessage, detectLanguage } from "./services/ai-code";
import { createProjectZip, saveUploadedFile } from "./services/workspace";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // GitHub OAuth routes
  app.get("/api/auth/github", async (req, res) => {
    try {
      const authUrl = await getGitHubAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to get GitHub auth URL" });
    }
  });

  app.post("/api/auth/github/callback", async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Authorization code is required" });
      }

      const accessToken = await exchangeCodeForToken(code);
      const githubUser = await getGitHubUser(accessToken);
      
      // Check if user exists, create if not
      let user = await storage.getUserByGithubId(githubUser.id.toString());
      if (!user) {
        user = await storage.createUser({
          githubId: githubUser.id.toString(),
          username: githubUser.login,
          email: githubUser.email,
          avatarUrl: githubUser.avatar_url,
          accessToken,
        });
      } else {
        // Update access token
        user = await storage.updateUser(user.id, { accessToken });
      }

      res.json({ user: { ...user, accessToken: undefined } }); // Don't send token to client
    } catch (error) {
      console.error("GitHub auth error:", error);
      res.status(500).json({ message: "GitHub authentication failed" });
    }
  });

  // Repository routes
  app.get("/api/repositories", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const repositories = await storage.getRepositories(userId);
      res.json(repositories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch repositories" });
    }
  });

  app.get("/api/repositories/github", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.accessToken) {
        return res.status(401).json({ message: "GitHub access token not found" });
      }

      const githubRepos = await getGitHubRepositories(user.accessToken);
      res.json(githubRepos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch GitHub repositories" });
    }
  });

  app.post("/api/repositories/clone", async (req, res) => {
    try {
      const { repositoryId, userId } = req.body;
      
      if (!repositoryId || !userId) {
        return res.status(400).json({ message: "Repository ID and User ID are required" });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.accessToken) {
        return res.status(401).json({ message: "GitHub access token not found" });
      }

      // Find or create repository record
      let repository = await storage.getRepository(repositoryId);
      if (!repository) {
        return res.status(404).json({ message: "Repository not found" });
      }

      // Clone the repository
      const gitService = new GitService(repository.name);
      await gitService.cloneRepository(repository.cloneUrl, user.accessToken);
      
      // Update repository status
      repository = await storage.updateRepository(repositoryId, {
        isCloned: true,
        localPath: gitService.getRepoPath(),
      });

      // Load files into workspace
      const files = await gitService.listFiles();
      for (const filePath of files) {
        const content = await gitService.readFile(filePath);
        if (content !== null) {
          await storage.createWorkspaceFile({
            repositoryId,
            path: filePath,
            content,
            language: detectLanguage(filePath),
            isModified: false,
            isTracked: true,
          });
        }
      }

      res.json({ repository, message: "Repository cloned successfully" });
    } catch (error) {
      console.error("Clone error:", error);
      res.status(500).json({ message: "Failed to clone repository" });
    }
  });

  app.post("/api/repositories", async (req, res) => {
    try {
      const validatedData = insertRepositorySchema.parse(req.body);
      const repository = await storage.createRepository(validatedData);
      res.status(201).json(repository);
    } catch (error) {
      res.status(400).json({ message: "Invalid repository data" });
    }
  });

  // Workspace file routes
  app.get("/api/workspace/files", async (req, res) => {
    try {
      const repositoryId = req.query.repositoryId as string;
      const files = await storage.getWorkspaceFiles(repositoryId);
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workspace files" });
    }
  });

  app.get("/api/workspace/files/:id", async (req, res) => {
    try {
      const file = await storage.getWorkspaceFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      res.json(file);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch file" });
    }
  });

  app.post("/api/workspace/files", async (req, res) => {
    try {
      const validatedData = insertWorkspaceFileSchema.parse(req.body);
      const file = await storage.createWorkspaceFile(validatedData);
      res.status(201).json(file);
    } catch (error) {
      res.status(400).json({ message: "Invalid file data" });
    }
  });

  app.put("/api/workspace/files/:id", async (req, res) => {
    try {
      const { content, isModified } = req.body;
      const file = await storage.updateWorkspaceFile(req.params.id, {
        content,
        isModified: isModified !== undefined ? isModified : true,
      });
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      res.json(file);
    } catch (error) {
      res.status(500).json({ message: "Failed to update file" });
    }
  });

  app.delete("/api/workspace/files/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteWorkspaceFile(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "File not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // File upload route
  app.post("/api/workspace/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { repositoryId } = req.body;
      const content = req.file.buffer.toString("utf-8");
      const language = detectLanguage(req.file.originalname);
      
      const file = await storage.createWorkspaceFile({
        repositoryId: repositoryId || null,
        path: req.file.originalname,
        content,
        language,
        isModified: false,
        isTracked: false,
      });

      res.status(201).json(file);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Git operations
  app.post("/api/git/status", async (req, res) => {
    try {
      const { repositoryName } = req.body;
      if (!repositoryName) {
        return res.status(400).json({ message: "Repository name is required" });
      }

      const gitService = new GitService(repositoryName);
      const status = await gitService.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get git status" });
    }
  });

  app.post("/api/git/commit", async (req, res) => {
    try {
      const { repositoryName, message, files, authorName, authorEmail, userId } = req.body;
      
      if (!repositoryName || !message) {
        return res.status(400).json({ message: "Repository name and message are required" });
      }

      const gitService = new GitService(repositoryName);
      
      // Add files if specified
      if (files && files.length > 0) {
        await gitService.addFiles(files);
      }
      
      // Commit with author info if provided
      const author = authorName && authorEmail ? { name: authorName, email: authorEmail } : undefined;
      const commitHash = await gitService.commit(message, author);
      
      res.json({ commitHash, message: "Commit successful" });
    } catch (error) {
      console.error("Commit error:", error);
      res.status(500).json({ message: "Failed to commit changes" });
    }
  });

  app.post("/api/git/push", async (req, res) => {
    try {
      const { repositoryName, branch, userId } = req.body;
      
      if (!repositoryName || !userId) {
        return res.status(400).json({ message: "Repository name and user ID are required" });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.accessToken) {
        return res.status(401).json({ message: "GitHub access token not found" });
      }

      const gitService = new GitService(repositoryName);
      await gitService.push(branch || "main", user.accessToken);
      
      res.json({ message: "Push successful" });
    } catch (error) {
      console.error("Push error:", error);
      res.status(500).json({ message: "Failed to push changes" });
    }
  });

  app.get("/api/git/branches/:repositoryName", async (req, res) => {
    try {
      const gitService = new GitService(req.params.repositoryName);
      const branches = await gitService.getBranches();
      const currentBranch = await gitService.getCurrentBranch();
      
      res.json({ branches, currentBranch });
    } catch (error) {
      res.status(500).json({ message: "Failed to get branches" });
    }
  });

  app.post("/api/git/branch", async (req, res) => {
    try {
      const { repositoryName, branchName, switchTo } = req.body;
      
      if (!repositoryName || !branchName) {
        return res.status(400).json({ message: "Repository name and branch name are required" });
      }

      const gitService = new GitService(repositoryName);
      
      if (switchTo) {
        await gitService.switchBranch(branchName);
      } else {
        await gitService.createBranch(branchName);
      }
      
      res.json({ message: `Branch ${switchTo ? 'switched to' : 'created'}: ${branchName}` });
    } catch (error) {
      res.status(500).json({ message: `Failed to ${req.body.switchTo ? 'switch to' : 'create'} branch` });
    }
  });

  app.get("/api/git/history/:repositoryName", async (req, res) => {
    try {
      const gitService = new GitService(req.params.repositoryName);
      const limit = parseInt(req.query.limit as string) || 10;
      const history = await gitService.getCommitHistory(limit);
      
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to get commit history" });
    }
  });

  app.get("/api/git/diff/:repositoryName", async (req, res) => {
    try {
      const gitService = new GitService(req.params.repositoryName);
      const file = req.query.file as string;
      const diff = await gitService.getDiff(file);
      
      res.json({ diff });
    } catch (error) {
      res.status(500).json({ message: "Failed to get diff" });
    }
  });

  // AI-powered code operations
  app.post("/api/ai/code-operation", async (req, res) => {
    try {
      const { operation, apiKey, repositoryName } = req.body;
      
      if (!operation || !apiKey) {
        return res.status(400).json({ message: "Operation and API key are required" });
      }

      const gitService = repositoryName ? new GitService(repositoryName) : undefined;
      const result = await performAICodeOperation(operation, apiKey, gitService);
      
      if (result.success && gitService) {
        // Apply changes to files
        for (const change of result.changes) {
          await gitService.writeFile(change.path, change.content);
          
          // Update workspace file record
          const existingFile = await storage.getWorkspaceFileByPath(change.path, repositoryName);
          if (existingFile) {
            await storage.updateWorkspaceFile(existingFile.id, {
              content: change.content,
              isModified: true,
            });
          } else {
            await storage.createWorkspaceFile({
              repositoryId: repositoryName,
              path: change.path,
              content: change.content,
              language: change.language || detectLanguage(change.path),
              isModified: true,
              isTracked: false,
            });
          }
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error("AI operation error:", error);
      res.status(500).json({ message: "Failed to perform AI operation" });
    }
  });

  app.post("/api/ai/commit-message", async (req, res) => {
    try {
      const { changes, apiKey } = req.body;
      
      if (!changes || !apiKey) {
        return res.status(400).json({ message: "Changes and API key are required" });
      }

      const message = await generateCommitMessage(changes, apiKey);
      res.json({ message });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate commit message" });
    }
  });

  // Project download
  app.get("/api/workspace/download/:repositoryName", async (req, res) => {
    try {
      const { repositoryName } = req.params;
      const gitService = new GitService(repositoryName);
      const projectPath = gitService.getRepoPath();
      
      const zipBuffer = await createProjectZip(projectPath, repositoryName);
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${repositoryName}.zip"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Failed to create project download" });
    }
  });
  // Gemini API validation
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

  // API usage stats
  app.post("/api/usage-stats", async (req, res) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ message: "API key is required" });
      }

      const { getApiUsage } = await import("./services/gemini");
      const usage = getApiUsage(apiKey);
      
      res.json(usage || {
        requestCount: 0,
        totalTokens: 0,
        lastRequestTime: new Date(),
        rateLimitRemaining: 60,
        rateLimitReset: new Date(Date.now() + 60000)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get usage stats" });
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
      const aiResponse = await generateCodeResponse(content, apiKey);
      
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

  // Download workspace as ZIP
  app.get("/api/workspace/download", async (req, res) => {
    try {
      const { createProjectZip } = await import("./services/workspace");
      const workspacePath = process.cwd();
      
      // Create project name based on timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      const projectName = `ai-generated-project-${timestamp}`;
      
      const zipBuffer = await createProjectZip(workspacePath, projectName);
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${projectName}.zip"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error("Error downloading workspace:", error);
      res.status(500).json({ message: "Failed to download workspace" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
