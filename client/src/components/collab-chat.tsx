import { useEffect, useState, useRef } from "react";
import { getSocket, sendRepoChat } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CollabChatProps {
  repositoryName?: string;
}

interface ChatEvent {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface GitEvent {
  userId: string;
  event: string;
  payload?: any;
  timestamp: number;
}

export function CollabChat({ repositoryName }: CollabChatProps) {
  const [messages, setMessages] = useState<ChatEvent[]>([]);
  const [gitEvents, setGitEvents] = useState<GitEvent[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!repositoryName) return;
    const socket = getSocket();
    const onChat = (data: ChatEvent) => setMessages((m) => [...m, data]);
    const onGit = (data: GitEvent) => setGitEvents((g) => [...g, data]);

    socket.on("chat", onChat);
    socket.on("gitEvent", onGit);
    return () => {
      socket.off("chat", onChat);
      socket.off("gitEvent", onGit);
    };
  }, [repositoryName]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, gitEvents]);

  const send = () => {
    if (!input.trim() || !repositoryName) return;
    sendRepoChat(repositoryName, input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-slate-700">
      <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <div key={`m-${i}`} className="text-sm">
            <span className="font-medium">{m.username}</span>: {m.message}
          </div>
        ))}
        {gitEvents.map((e, i) => (
          <div key={`g-${i}`} className="text-xs text-gray-500">
            [{new Date(e.timestamp).toLocaleTimeString()}] Git: {e.event}
          </div>
        ))}
      </div>
      <div className="p-2 flex gap-2 border-t border-gray-200 dark:border-slate-700">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message team..." onKeyDown={(e) => e.key === 'Enter' && send()} />
        <Button onClick={send} size="sm">Send</Button>
      </div>
    </div>
  );
}