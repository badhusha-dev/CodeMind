import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Download, Trash2, Loader2, Paperclip, FolderDown, FileText, X } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { Message, Chat } from "@/types/chat";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ChatInterfaceProps {
  chatId: string | null;
  apiKey: string;
}

export function ChatInterface({ chatId, apiKey }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State for new project modal (for future implementation based on user request)
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedFramework, setSelectedFramework] = useState("");


  const { data: chat } = useQuery<Chat>({
    queryKey: ["/api/chats", chatId],
    enabled: !!chatId,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/chats", chatId, "messages"],
    enabled: !!chatId,
    refetchOnWindowFocus: false,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, chatId: currentChatId }: { content: string; chatId: string }) => {
      const response = await apiRequest("POST", `/api/chats/${currentChatId}/messages`, {
        content,
        apiKey,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats", chatId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setMessage("");
    },
  });

  const downloadChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const response = await fetch(`/api/chats/${chatId}/download`);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-${chatId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  });

  const downloadProjectMutation = useMutation({
    mutationFn: async () => {
      // State for download progress, if needed in the future
      // const [isDownloading, setIsDownloading] = useState(false); // This line is not in original, but present in changes
      // For now, assuming isDownloading is managed elsewhere or not directly needed for this mutation's state

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      const filename = `ai-generated-project-${timestamp}.zip`;

      // Get current project framework info from localStorage or context
      const projectLanguage = localStorage.getItem('currentProjectLanguage');
      const projectFramework = localStorage.getItem('currentProjectFramework');

      const url = new URL("/api/workspace/download", window.location.origin);
      if (projectLanguage && projectFramework) {
        url.searchParams.set('language', projectLanguage);
        url.searchParams.set('framework', projectFramework);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/zip",
        },
      });


      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/zip")) {
        throw new Error("Invalid file type received");
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }


      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      }, 100);

      return { filename, size: blob.size };
    },
    onSuccess: (data) => {
      toast({
        title: "Project Downloaded",
        description: `${data.filename} (${(data.size / 1024).toFixed(1)} KB) downloaded successfully.`,
      });
    },
    onError: (error) => {
      console.error("Download error:", error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !chatId || sendMessageMutation.isPending) return;

    sendMessageMutation.mutate({ content: message.trim(), chatId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const downloadChat = () => {
    if (chatId) {
      downloadChatMutation.mutate(chatId);
    }
  };

  const handleDownloadProject = () => {
    // Here, we would typically trigger the new project creation if not already done,
    // but for this fix, we directly call the mutation.
    // In a full implementation, this would involve opening the modal first.
    if (downloadProjectMutation.isPending) return;
    downloadProjectMutation.mutate();
  };

  // Placeholder function for new project creation
  const createNewProject = async () => {
    if (!selectedLanguage || !selectedFramework) {
      toast({
        title: "Missing Information",
        description: "Please select both programming language and framework.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/new-project", {
        language: selectedLanguage,
        framework: selectedFramework,
      });
      const result = await response.json();

      // Store selection in workspace session (e.g., localStorage for simplicity)
      localStorage.setItem('currentProjectLanguage', selectedLanguage);
      localStorage.setItem('currentProjectFramework', selectedFramework);

      toast({
        title: "New Project Created",
        description: `Project scaffolded for ${selectedFramework} (${selectedLanguage}).`,
      });

      // Close modal and potentially refresh or navigate
      setIsNewProjectModalOpen(false);
      // In a real app, you might want to clear current messages or start a new chat context.
      // queryClient.invalidateQueries({ queryKey: ["/api/chats"] }); // Example to refresh chats list
    } catch (error) {
      console.error("Project creation failed:", error);
      toast({
        title: "Project Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create project.",
        variant: "destructive",
      });
    }
  };

  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Welcome to Code AI Agent
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Start a new conversation to begin coding with AI assistance. Click "New Chat" to get started.
          </p>
          {/* Button to open the new project modal */}
          <Button onClick={() => setIsNewProjectModalOpen(true)} className="mt-4">
            New Project
          </Button>
        </div>

        {/* New Project Modal (Placeholder for implementation) */}
        {isNewProjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-lg w-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Project</h3>
                <Button variant="ghost" size="icon" onClick={() => setIsNewProjectModalOpen(false)}>
                  <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </Button>
              </div>
              <div className="space-y-6">
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Programming Language</label>
                  <select
                    id="language"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Language</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="TypeScript">TypeScript</option>
                    <option value="Python">Python</option>
                    <option value="Java">Java</option>
                    {/* Add more languages */}
                  </select>
                </div>
                <div>
                  <label htmlFor="framework" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Framework</label>
                  <select
                    id="framework"
                    value={selectedFramework}
                    onChange={(e) => setSelectedFramework(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Framework</option>
                    {/* Options based on language, simplified here */}
                    {selectedLanguage === "JavaScript" && (
                      <>
                        <option value="React">React</option>
                        <option value="Next.js">Next.js</option>
                        <option value="Node.js + Express">Node.js + Express</option>
                      </>
                    )}
                    {selectedLanguage === "Python" && (
                      <>
                        <option value="Flask">Flask</option>
                        <option value="Django">Django</option>
                      </>
                    )}
                    {selectedLanguage === "Java" && (
                      <>
                        <option value="Spring Boot">Spring Boot</option>
                      </>
                    )}
                    {/* Add more frameworks */}
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={createNewProject} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Create Project
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {chat?.title || "Loading..."}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ask me about any programming language or framework
              </p>
            </div>
          </div>

          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadChat}
              disabled={downloadChatMutation.isPending || messages.length === 0}
              title="Download chat as .txt"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 dark:bg-slate-800">
        {messagesLoading ? (
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Send className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-gray-800 dark:text-gray-200 mb-2">
                  <strong>Welcome to Code AI Agent!</strong> 👋
                </p>
                <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                  I'm your AI coding assistant powered by Google's Gemini 2.5 Pro. I can help you:
                </p>
                <ul className="text-gray-700 dark:text-gray-300 text-sm ml-4 space-y-1 mb-3">
                  <li>• Generate code in any programming language or framework</li>
                  <li>• Debug and fix coding errors</li>
                  <li>• Explain complex code concepts</li>
                  <li>• Review and optimize your code</li>
                </ul>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Just mention the language or framework you want to work with in your message! 🚀
                </p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {sendMessageMutation.isPending && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className="flex-1">
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">AI is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show project download option after AI responses */}
        {!sendMessageMutation.isPending && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
          <div className="flex justify-center">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-md">
              <div className="text-center">
                <FolderDown className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Download Your Project
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Get all the AI-generated code and files as a ZIP archive
                </p>
                <Button
                  onClick={handleDownloadProject}
                  disabled={downloadProjectMutation.isPending}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {downloadProjectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <FolderDown className="w-4 h-4 mr-2" />
                  )}
                  Download Project
                </Button>
              </div>
            </div>
          </div>
        )}



        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex space-x-4">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me about any language or framework... (Shift+Enter for new line)"
                className="min-h-[48px] max-h-[120px] resize-none pr-12"
                disabled={sendMessageMutation.isPending}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-3 top-3 p-1 h-auto"
                title="Attach file (code files only)"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>

            <Button
              type="submit"
              disabled={!message.trim() || sendMessageMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 px-6"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send
            </Button>
          </form>

          <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span>Press Shift+Enter for new line</span>
              <span>•</span>
              <span>Powered by Gemini 2.5 Pro</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Connected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}