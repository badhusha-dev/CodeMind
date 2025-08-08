import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Folder, 
  File, 
  FolderOpen, 
  Plus, 
  Upload, 
  Download,
  GitBranch,
  GitCommit,
  GitPush,
  MoreHorizontal,
  Circle,
  Dot
} from "lucide-react";
import { WorkspaceFile, Repository, GitStatus } from "@/types/github";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FileExplorerProps {
  currentRepository: Repository | null;
  selectedFile: WorkspaceFile | null;
  onFileSelect: (file: WorkspaceFile) => void;
  onFileCreate: (path: string, content?: string) => void;
  currentUser: any;
}

interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
  file?: WorkspaceFile;
}

export function FileExplorer({ 
  currentRepository, 
  selectedFile, 
  onFileSelect, 
  onFileCreate,
  currentUser 
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([""]));
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: files = [] } = useQuery<WorkspaceFile[]>({
    queryKey: ["/api/workspace/files", currentRepository?.id],
    enabled: !!currentRepository?.id,
  });

  const { data: gitStatus } = useQuery<GitStatus>({
    queryKey: ["/api/git/status", currentRepository?.name],
    enabled: !!currentRepository?.name,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/workspace/upload", {
        method: "POST",
        body: formData,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/files"] });
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async (fileData: { path: string; content: string; repositoryId?: string }) => {
      const response = await apiRequest("POST", "/api/workspace/files", {
        ...fileData,
        repositoryId: currentRepository?.id || null,
        language: detectLanguage(fileData.path),
        isModified: true,
        isTracked: false,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/files"] });
      setShowNewFileDialog(false);
      setNewFileName("");
    },
  });

  const downloadProjectMutation = useMutation({
    mutationFn: async () => {
      if (!currentRepository) throw new Error("No repository selected");
      
      const response = await fetch(`/api/workspace/download/${currentRepository.name}`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentRepository.name}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  });

  // Build file tree from flat file list
  const buildFileTree = (files: WorkspaceFile[]): FileTreeNode[] => {
    const tree: FileTreeNode[] = [];
    const pathMap = new Map<string, FileTreeNode>();

    // Sort files by path
    files.sort((a, b) => a.path.localeCompare(b.path));

    for (const file of files) {
      const parts = file.path.split("/");
      let currentPath = "";
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!pathMap.has(currentPath)) {
          const node: FileTreeNode = {
            name: part,
            path: currentPath,
            type: i === parts.length - 1 ? "file" : "folder",
            children: i === parts.length - 1 ? undefined : [],
            file: i === parts.length - 1 ? file : undefined,
          };
          
          pathMap.set(currentPath, node);
          
          if (parentPath) {
            const parent = pathMap.get(parentPath);
            if (parent && parent.children) {
              parent.children.push(node);
            }
          } else {
            tree.push(node);
          }
        }
      }
    }

    return tree;
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      if (currentRepository?.id) {
        formData.append("repositoryId", currentRepository.id);
      }
      uploadFileMutation.mutate(formData);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    files.forEach(file => {
      const formData = new FormData();
      formData.append("file", file);
      if (currentRepository?.id) {
        formData.append("repositoryId", currentRepository.id);
      }
      uploadFileMutation.mutate(formData);
    });
  };

  const handleCreateFile = () => {
    if (newFileName.trim()) {
      createFileMutation.mutate({
        path: newFileName.trim(),
        content: "",
        repositoryId: currentRepository?.id,
      });
    }
  };

  const getFileStatus = (filePath: string): "modified" | "new" | "staged" | null => {
    if (!gitStatus) return null;
    
    if (gitStatus.staged.includes(filePath)) return "staged";
    if (gitStatus.modified.includes(filePath)) return "modified";
    if (gitStatus.not_added.includes(filePath) || gitStatus.created.includes(filePath)) return "new";
    
    return null;
  };

  const detectLanguage = (fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      go: "go",
      rs: "rust",
      php: "php",
      rb: "ruby",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      yml: "yaml",
      yaml: "yaml",
    };
    return languageMap[ext || ""] || "text";
  };

  const renderFileTree = (nodes: FileTreeNode[], depth = 0): JSX.Element[] => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className={cn(
            "flex items-center space-x-2 py-1 px-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer",
            selectedFile?.path === node.path && "bg-blue-50 dark:bg-blue-900/20",
            depth > 0 && "ml-4"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === "folder") {
              toggleFolder(node.path);
            } else if (node.file) {
              onFileSelect(node.file);
            }
          }}
        >
          {node.type === "folder" ? (
            expandedFolders.has(node.path) ? (
              <FolderOpen className="w-4 h-4 text-blue-600" />
            ) : (
              <Folder className="w-4 h-4 text-blue-600" />
            )
          ) : (
            <File className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
          
          <span className={cn(
            "flex-1 text-sm",
            selectedFile?.path === node.path && "font-medium"
          )}>
            {node.name}
          </span>
          
          {node.type === "file" && node.file && (() => {
            const status = getFileStatus(node.path);
            return status ? (
              <div className={cn(
                "w-2 h-2 rounded-full",
                status === "modified" && "bg-yellow-500",
                status === "new" && "bg-green-500",
                status === "staged" && "bg-blue-500"
              )} />
            ) : null;
          })()}
        </div>
        
        {node.type === "folder" && 
         node.children && 
         expandedFolders.has(node.path) && 
         renderFileTree(node.children, depth + 1)}
      </div>
    ));
  };

  const fileTree = buildFileTree(files);

  return (
    <div className="w-80 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {currentRepository ? currentRepository.name : "Workspace"}
          </h2>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="p-2">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowNewFileDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Upload File
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => downloadProjectMutation.mutate()}
                disabled={!currentRepository || downloadProjectMutation.isPending}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {currentRepository && (
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <GitBranch className="w-4 h-4" />
            <span>main</span>
            
            {gitStatus && (
              <div className="flex items-center space-x-1 ml-2">
                {gitStatus.modified.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <Circle className="w-3 h-3 text-yellow-500" />
                    <span>{gitStatus.modified.length}</span>
                  </div>
                )}
                {gitStatus.not_added.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <Circle className="w-3 h-3 text-green-500" />
                    <span>{gitStatus.not_added.length}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* File Tree */}
      <ScrollArea 
        className="flex-1"
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className={cn(
          "p-2",
          dragOver && "bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300"
        )}>
          {files.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No files yet</p>
              <p className="text-xs">Upload files or create new ones</p>
            </div>
          ) : (
            renderFileTree(fileTree)
          )}
          
          {dragOver && (
            <div className="text-center py-4 text-blue-600 dark:text-blue-400">
              <Upload className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-medium">Drop files here to upload</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
        multiple
      />

      {/* New File Dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>
              Enter the name for your new file. Include the file extension.
            </DialogDescription>
          </DialogHeader>
          
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="filename.js"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreateFile();
              }
            }}
          />
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateFile}
              disabled={!newFileName.trim() || createFileMutation.isPending}
            >
              Create File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}