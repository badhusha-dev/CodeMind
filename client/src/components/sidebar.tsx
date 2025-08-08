import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings, LogOut, Trash2, FolderPlus } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Chat } from "@/types/chat";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApiUsageDisplay } from "./api-usage-display";
import { NewProjectModal } from "./new-project-modal";

interface SidebarProps {
  currentChatId: string | null;
  onSelectChat: (chatId: string | null) => void;
  onLogout: () => void;
  apiKey: string;
}

export function Sidebar({ currentChatId, onSelectChat, onLogout, apiKey }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const { data: chats = [], isLoading } = useQuery<Chat[]>({
    queryKey: ["/api/chats"],
    refetchOnWindowFocus: false,
  });

  const createChatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/chats", {
        title: "New Chat",
      });
      return response.json();
    },
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      onSelectChat(newChat.id);
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      await apiRequest("DELETE", `/api/chats/${chatId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      if (currentChatId && deleteChatMutation.variables === currentChatId) {
        onSelectChat(null);
      }
    },
  });

  const handleNewChat = () => {
    createChatMutation.mutate();
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffHours < 24) {
      return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else {
      return `${diffDays} days ago`;
    }
  };

  return (
    <div className="w-80 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Code AI Agent</h1>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="p-2 h-auto"
            >
              {theme === "dark" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </Button>
            <Button variant="ghost" size="sm" className="p-2 h-auto">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleNewChat}
            disabled={createChatMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
          
          <Button
            onClick={() => setShowNewProjectModal(true)}
            variant="outline"
            className="w-full"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Recent Chats</h3>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 dark:bg-slate-700 rounded-lg h-16" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No chats yet. Start a new conversation!
            </p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                "group p-3 rounded-lg cursor-pointer transition-colors",
                currentChatId === chat.id
                  ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                  : "hover:bg-gray-100 dark:hover:bg-slate-700/50"
              )}
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    currentChatId === chat.id
                      ? "text-blue-900 dark:text-blue-100"
                      : "text-gray-900 dark:text-white"
                  )}>
                    {chat.title}
                  </p>
                  <p className={cn(
                    "text-xs mt-1",
                    currentChatId === chat.id
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-gray-500 dark:text-gray-400"
                  )}>
                    {formatDate(new Date(chat.updatedAt))}
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 p-1 h-auto ml-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Chat</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this chat? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteChatMutation.mutate(chat.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>

      {/* API Usage Display */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700">
        <ApiUsageDisplay apiKey={apiKey} />
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">U</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">User</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Gemini 2.5 Pro</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="p-2 h-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <NewProjectModal 
        open={showNewProjectModal}
        onOpenChange={setShowNewProjectModal}
        onProjectCreated={(project) => {
          // Optionally handle project creation success
          console.log('Project created:', project);
        }}
      />
    </div>
  );
}