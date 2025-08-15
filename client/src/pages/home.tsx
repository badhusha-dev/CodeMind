import { useState, useEffect } from "react";
import { ApiKeyModal } from "@/components/api-key-modal";
import { Sidebar } from "@/components/sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { GitHubAuth } from "@/components/github-auth";
import { RepositoryManager } from "@/components/repository-manager";
import { FileExplorer } from "@/components/file-explorer";
import { CodeEditor } from "@/components/code-editor";
import { GitHubUser, Repository, WorkspaceFile } from "@/types/github";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CollabChat } from "@/components/collab-chat";
import { joinRepository, leaveRepository } from "@/lib/socket";

export default function Home() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [currentRepository, setCurrentRepository] = useState<Repository | null>(null);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [currentProject, setCurrentProject] = useState<{language: string, framework: string} | null>(null);
  const [activeTab, setActiveTab] = useState("chat");

  useEffect(() => {
    const savedApiKey = localStorage.getItem("gemini_api_key");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }

    const projectLanguage = localStorage.getItem('currentProjectLanguage');
    const projectFramework = localStorage.getItem('currentProjectFramework');
    if (projectLanguage && projectFramework) {
      setCurrentProject({ language: projectLanguage, framework: projectFramework });
    }
  }, []);

  useEffect(() => {
    if (currentRepository?.name) {
      joinRepository(currentRepository.name);
      return () => {
        leaveRepository(currentRepository.name!);
      };
    }
  }, [currentRepository?.name]);

  const handleApiKeySet = (newApiKey: string) => {
    setApiKey(newApiKey);
  };

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("gemini_api_key");
    setApiKey(null);
    setCurrentChatId(null);
    setGithubUser(null);
    setCurrentRepository(null);
    setSelectedFile(null);
    setShowLogoutDialog(false);
  };

  const handleGitHubAuth = (user: GitHubUser) => {
    setGithubUser(user);
    setActiveTab("repositories");
  };

  const handleRepositorySelect = (repository: Repository) => {
    setCurrentRepository(repository);
    setActiveTab("workspace");
  };

  const handleFileSelect = (file: WorkspaceFile) => {
    setSelectedFile(file);
  };

  const handleFileCreate = (path: string, content?: string) => {
    console.log("Creating file:", path, content);
  };

  const handleNewChat = () => {
    const newChatId = `chat_${Date.now()}`;
    setCurrentChatId(newChatId);
    console.log("New chat created:", newChatId);
  };

  const handleNewProject = (language: string, framework: string) => {
    localStorage.setItem('currentProjectLanguage', language);
    localStorage.setItem('currentProjectFramework', framework);
    setCurrentProject({ language, framework });
    setCurrentChatId(null);
    setSelectedFile(null);
    setActiveTab("workspace");
  };

  if (!apiKey) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <ApiKeyModal open={true} onApiKeySet={handleApiKeySet} />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen bg-gray-50 dark:bg-slate-900">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex">
          <div className="w-80 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Code AI Agent</h1>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="repositories">Repos</TabsTrigger>
                <TabsTrigger value="workspace">Files</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="chat" className="h-full">
                <Sidebar 
                  currentChatId={currentChatId}
                  onSelectChat={setCurrentChatId}
                  onLogout={handleLogout}
                  apiKey={apiKey}
                />
              </TabsContent>

              <TabsContent value="repositories" className="h-full">
                <div className="p-4 h-full overflow-y-auto">
                  {githubUser ? (
                    <RepositoryManager
                      currentUser={githubUser}
                      onRepositorySelect={handleRepositorySelect}
                      selectedRepository={currentRepository}
                    />
                  ) : (
                    <GitHubAuth onAuthSuccess={handleGitHubAuth} />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="workspace" className="h-full">
                {currentRepository ? (
                  <FileExplorer
                    currentRepository={currentRepository}
                    selectedFile={selectedFile}
                    onFileSelect={handleFileSelect}
                    onFileCreate={handleFileCreate}
                    currentUser={githubUser}
                  />
                ) : (
                  <div className="p-4 text-center text-gray-500">Select a repository first</div>
                )}
              </TabsContent>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-3">
            <div className="col-span-2">
              <TabsContent value="chat" className="h-full">
                <ChatInterface chatId={currentChatId} apiKey={apiKey} />
              </TabsContent>

              <TabsContent value="repositories" className="h-full">
                <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-slate-800">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Repository Management</h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      {githubUser 
                        ? "Select a repository from the sidebar to clone and work with"
                        : "Connect your GitHub account to access your repositories"
                      }
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="workspace" className="h-full">
                <CodeEditor
                  file={selectedFile}
                  apiKey={apiKey}
                  currentRepository={currentRepository}
                  currentUser={githubUser}
                  currentProject={currentProject}
                />
              </TabsContent>
            </div>
            <div className="col-span-1 border-l border-gray-200 dark:border-slate-700">
              <TabsContent value="workspace" className="h-full">
                <CollabChat repositoryName={currentRepository?.name} />
              </TabsContent>
              <TabsContent value="chat" className="h-full" />
              <TabsContent value="repositories" className="h-full" />
            </div>
          </div>
        </Tabs>
      </div>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to logout? Your API key will be removed from this device.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout} className="bg-red-600 hover:bg-red-700">Logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}