import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io("", { withCredentials: true, autoConnect: true });
  }
  return socket;
}

export function joinRepository(repositoryName: string) {
  getSocket().emit("joinRepo", { repositoryName });
}

export function leaveRepository(repositoryName: string) {
  getSocket().emit("leaveRepo", { repositoryName });
}

export function joinFile(repositoryName: string, path: string) {
  getSocket().emit("joinFile", { repositoryName, path });
}

export function leaveFile(repositoryName: string, path: string) {
  getSocket().emit("leaveFile", { repositoryName, path });
}

export function sendCursor(repositoryName: string, path: string, cursor: any) {
  getSocket().emit("cursor", { repositoryName, path, cursor });
}

export function sendChange(repositoryName: string, path: string, content: string, baseVersion: number) {
  getSocket().emit("change", { repositoryName, path, content, baseVersion });
}

export function sendRepoChat(repositoryName: string, message: string) {
  getSocket().emit("chat", { repositoryName, message });
}

export function sendGitEvent(repositoryName: string, event: string, payload?: any) {
  getSocket().emit("gitEvent", { repositoryName, event, payload });
}