import { Server as IOServer } from "socket.io";
import type { Server } from "http";
import type { Express } from "express";
import { parseCookie, verifyToken } from "./middleware/auth";
import { storage } from "./storage";

interface PresenceUser {
  userId: string;
  username: string;
  color: string;
}

interface FileState {
  version: number;
  content?: string | null;
}

const COLORS = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#a3e635",
];

export function setupRealtime(httpServer: Server, _app: Express) {
  const io = new IOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  const roomToUsers = new Map<string, Map<string, PresenceUser>>();
  const fileStates = new Map<string, FileState>(); // key: repoName::path

  function getOrAssignColor(room: string, userId: string, username: string): PresenceUser {
    const users = roomToUsers.get(room) || new Map<string, PresenceUser>();
    roomToUsers.set(room, users);
    let user = users.get(userId);
    if (!user) {
      const color = COLORS[(users.size + userId.length) % COLORS.length];
      user = { userId, username, color };
      users.set(userId, user);
    }
    return user;
  }

  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie || "";
    const token = parseCookie(cookieHeader)["token"];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error("unauthorized"));
    (socket as any).user = payload;
    next();
  });

  io.on("connection", (socket) => {
    const user = (socket as any).user as { userId: string; username: string };

    socket.on("joinRepo", async ({ repositoryName }: { repositoryName: string }) => {
      const room = `repo:${repositoryName}`;
      socket.join(room);
      const presence = getOrAssignColor(room, user.userId, user.username);
      io.to(room).emit("presence", Array.from((roomToUsers.get(room) || new Map()).values()));
      socket.emit("joinedRepo", { repositoryName, self: presence });
    });

    socket.on("leaveRepo", ({ repositoryName }: { repositoryName: string }) => {
      const room = `repo:${repositoryName}`;
      socket.leave(room);
      const users = roomToUsers.get(room);
      if (users) {
        users.delete(user.userId);
        io.to(room).emit("presence", Array.from(users.values()));
      }
    });

    socket.on("joinFile", async ({ repositoryName, path }: { repositoryName: string; path: string }) => {
      const room = `file:${repositoryName}:${path}`;
      socket.join(room);
      const key = `${repositoryName}::${path}`;
      if (!fileStates.has(key)) {
        const wf = await storage.getWorkspaceFileByPath(path, repositoryName);
        fileStates.set(key, { version: 1, content: wf?.content ?? "" });
      }
      const state = fileStates.get(key)!;
      socket.emit("fileState", { path, version: state.version, content: state.content });
      socket.to(room).emit("userJoinedFile", { userId: user.userId, username: user.username });
    });

    socket.on("leaveFile", ({ repositoryName, path }: { repositoryName: string; path: string }) => {
      const room = `file:${repositoryName}:${path}`;
      socket.leave(room);
      socket.to(room).emit("userLeftFile", { userId: user.userId });
    });

    socket.on("cursor", ({ repositoryName, path, cursor }: { repositoryName: string; path: string; cursor: any }) => {
      const room = `file:${repositoryName}:${path}`;
      socket.to(room).emit("cursor", { userId: user.userId, username: user.username, cursor });
    });

    socket.on(
      "change",
      async ({ repositoryName, path, content, baseVersion }: { repositoryName: string; path: string; content: string; baseVersion: number }) => {
        const key = `${repositoryName}::${path}`;
        let state = fileStates.get(key);
        if (!state) {
          state = { version: 1, content };
          fileStates.set(key, state);
        }
        if (baseVersion !== state.version) {
          // Version mismatch: send latest to client to rebase
          socket.emit("conflict", { path, serverVersion: state.version, serverContent: state.content });
          return;
        }
        state.version += 1;
        state.content = content;
        // Persist to workspace storage mark as modified
        const wf = await storage.getWorkspaceFileByPath(path, repositoryName);
        if (wf) {
          await storage.updateWorkspaceFile(wf.id, { content, isModified: true });
        }
        const room = `file:${repositoryName}:${path}`;
        socket.to(room).emit("changed", { path, version: state.version, content });
      }
    );

    socket.on("chat", ({ repositoryName, message }: { repositoryName: string; message: string }) => {
      const room = `repo:${repositoryName}`;
      io.to(room).emit("chat", { userId: user.userId, username: user.username, message, timestamp: Date.now() });
    });

    socket.on("gitEvent", ({ repositoryName, event, payload }: any) => {
      const room = `repo:${repositoryName}`;
      io.to(room).emit("gitEvent", { userId: user.userId, event, payload, timestamp: Date.now() });
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room.startsWith("repo:")) {
          const users = roomToUsers.get(room);
          if (users) {
            users.delete(user.userId);
            io.to(room).emit("presence", Array.from(users.values()));
          }
        }
      }
    });
  });

  return io;
}