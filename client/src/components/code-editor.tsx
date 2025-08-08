import { useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Wand2, GitCommit, Eye } from "lucide-react";
import { WorkspaceFile, AICodeOperation } from "@/types/github";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { getSocket, joinFile, leaveFile, sendCursor, sendChange } from "@/lib/socket";

interface CodeEditorProps {
  file: WorkspaceFile | null;
  apiKey: string;
  currentRepository?: any;
  currentUser?: any;
  currentProject?: { language: string; framework: string } | null;
}

export function CodeEditor({ file, apiKey, currentRepository, currentUser }: CodeEditorProps) {
  const [content, setContent] = useState(file?.content || "");
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiOperation, setAiOperation] = useState<string>("");
  const [aiDescription, setAiDescription] = useState("");
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<string>("");
  const [remoteCursors, setRemoteCursors] = useState<Record<string, any>>({});
  const [docVersion, setDocVersion] = useState<number>(1);
  const editorRef = useRef<any>(null);
  const { theme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (file?.content !== undefined) {
      setContent(file.content || "");
    }
  }, [file]);

  // Socket.IO integration for live collaboration
  useEffect(() => {
    if (!currentRepository?.name || !file?.path) return;
    const repo = currentRepository.name as string;
    const path = file.path as string;

    joinFile(repo, path);
    const socket = getSocket();

    const handleFileState = (data: { path: string; version: number; content: string }) => {
      if (data.path === path) {
        setDocVersion(data.version);
        setContent(data.content);
      }
    };
    const handleChanged = (data: { path: string; version: number; content: string }) => {
      if (data.path === path) {
        setDocVersion(data.version);
        setContent(data.content);
      }
    };
    const handleConflict = (data: { path: string; serverVersion: number; serverContent: string }) => {
      if (data.path === path) {
        setDocVersion(data.serverVersion);
        setContent(data.serverContent);
        toast({ title: "Edit conflict", description: "Document updated to latest version. Please re-apply your change." });
      }
    };
    const handleCursor = (data: any) => {
      setRemoteCursors((prev) => ({ ...prev, [data.userId]: data }));
    };

    socket.on("fileState", handleFileState);
    socket.on("changed", handleChanged);
    socket.on("conflict", handleConflict);
    socket.on("cursor", handleCursor);

    return () => {
      leaveFile(repo, path);
      socket.off("fileState", handleFileState);
      socket.off("changed", handleChanged);
      socket.off("conflict", handleConflict);
      socket.off("cursor", handleCursor);
    };
  }, [currentRepository?.name, file?.path]);

  const saveFileMutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      if (!file) throw new Error("No file selected");
      const response = await apiRequest("PUT", `/api/workspace/files/${file.id}`, {
        content,
        isModified: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/files"] });
      toast({ title: "File saved", description: "Your changes have been saved successfully." });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Failed to save file changes.", variant: "destructive" });
    },
  });

  const aiOperationMutation = useMutation({
    mutationFn: async (operation: AICodeOperation) => {
      const response = await apiRequest("POST", "/api/ai/code-operation", {
        operation,
        apiKey,
        repositoryName: currentRepository?.name,
      });
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success && result.changes.length > 0) {
        const fileChange = result.changes.find((change: any) => change.path === file?.path);
        if (fileChange) {
          setPendingChanges(fileChange.content);
          setShowDiffPreview(true);
        }
        toast({ title: "AI operation completed", description: result.summary });
      } else {
        toast({ title: "AI operation failed", description: result.error || "Failed to perform AI operation", variant: "destructive" });
      }
    },
  });

  const handleSave = () => {
    if (file && content !== file.content) {
      saveFileMutation.mutate({ content });
    }
  };

  const handleAIOperation = (type: string) => {
    setAiOperation(type);
    setShowAIDialog(true);
  };

  const executeAIOperation = () => {
    if (!file || !aiDescription.trim()) return;
    const operation: AICodeOperation = {
      type: aiOperation as any,
      files: [file.path],
      description: aiDescription.trim(),
      repository: currentRepository?.name,
    };
    aiOperationMutation.mutate(operation);
    setShowAIDialog(false);
    setAiDescription("");
  };

  const applyChanges = () => {
    setContent(pendingChanges);
    setShowDiffPreview(false);
    setPendingChanges("");
    if (file && currentRepository?.name) {
      sendChange(currentRepository.name, file.path, pendingChanges, docVersion);
    }
    if (file) {
      saveFileMutation.mutate({ content: pendingChanges });
    }
  };

  const rejectChanges = () => {
    setShowDiffPreview(false);
    setPendingChanges("");
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const onEditorChange = (value?: string) => {
    const val = value ?? "";
    setContent(val);
    if (file && currentRepository?.name) {
      sendChange(currentRepository.name, file.path, val, docVersion);
    }
  };

  const onEditorCursor = () => {
    if (!editorRef.current || !file || !currentRepository?.name) return;
    const model = editorRef.current.getModel();
    const position = editorRef.current.getPosition();
    sendCursor(currentRepository.name, file.path, { position, uri: model?.uri.toString() });
  };

  const getLanguageFromFile = (file: WorkspaceFile): string => {
    if (file.language) return file.language;
    const ext = file.path.split(".").pop()?.toLowerCase();
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
      xml: "xml",
      sh: "bash",
    };
    return languageMap[ext || ""] || "plaintext";
  };

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 dark.bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Save className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No File Selected</h2>
          <p className="text-gray-600 dark:text-gray-400">Select a file from the explorer to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{file.path}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{file.language || "Plain text"} • {file.isModified ? "Modified" : "Saved"}</p>
          </div>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Wand2 className="w-4 h-4 mr-2" />
                  AI Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleAIOperation("refactor")}>Refactor Code</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIOperation("add_feature")}>Add Feature</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIOperation("fix_bugs")}>Fix Bugs</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIOperation("write_docs")}>Write Documentation</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIOperation("analyze")}>Analyze Code</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleSave} disabled={content === file.content || saveFileMutation.isPending} size="sm">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1" onKeyUp={onEditorCursor}>
        <Editor
          height="100%"
          language={getLanguageFromFile(file)}
          value={content}
          onChange={onEditorChange}
          onMount={handleEditorDidMount}
          theme={theme === "dark" ? "vs-dark" : "light"}
          options={{ fontSize: 14, minimap: { enabled: true }, wordWrap: "on", automaticLayout: true, scrollBeyondLastLine: false, formatOnPaste: true, formatOnType: true }}
        />
      </div>

      {/* AI Operation Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Code Operation</DialogTitle>
            <DialogDescription>
              Describe what you want the AI to do with your code.
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            placeholder={`Describe the ${aiOperation} you want to perform...`}
            rows={4}
          />
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={executeAIOperation}
              disabled={!aiDescription.trim() || aiOperationMutation.isPending}
            >
              {aiOperationMutation.isPending ? "Processing..." : "Apply AI Operation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diff Preview Dialog */}
      <Dialog open={showDiffPreview} onOpenChange={setShowDiffPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>AI Changes Preview</DialogTitle>
            <DialogDescription>
              Review the changes before applying them to your file.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 grid grid-cols-2 gap-4 h-96">
            <div>
              <h4 className="text-sm font-medium mb-2">Current Version</h4>
              <Editor
                height="100%"
                language={getLanguageFromFile(file)}
                value={content}
                theme={theme === "dark" ? "vs-dark" : "light"}
                options={{
                  readOnly: true,
                  fontSize: 12,
                  minimap: { enabled: false },
                }}
              />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">AI Changes</h4>
              <Editor
                height="100%"
                language={getLanguageFromFile(file)}
                value={pendingChanges}
                theme={theme === "dark" ? "vs-dark" : "light"}
                options={{
                  readOnly: true,
                  fontSize: 12,
                  minimap: { enabled: false },
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={rejectChanges}>
              Reject Changes
            </Button>
            <Button onClick={applyChanges}>
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}