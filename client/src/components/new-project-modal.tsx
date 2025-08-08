
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Code, Globe, Server, Database, Coffee, Zap } from "lucide-react";

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (project: any) => void;
}

interface FrameworkOption {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const languageOptions = [
  { value: 'javascript', label: 'JavaScript', icon: '🟨' },
  { value: 'typescript', label: 'TypeScript', icon: '🔷' },
  { value: 'python', label: 'Python', icon: '🐍' },
  { value: 'java', label: 'Java', icon: '☕' },
];

const frameworksByLanguage: Record<string, FrameworkOption[]> = {
  javascript: [
    { value: 'react-vite', label: 'React + Vite', description: 'Modern React with Vite build tool', icon: Code },
    { value: 'nextjs', label: 'Next.js', description: 'Full-stack React framework', icon: Globe },
    { value: 'express', label: 'Express.js', description: 'Node.js web framework', icon: Server },
    { value: 'node', label: 'Node.js', description: 'JavaScript runtime environment', icon: Zap },
  ],
  typescript: [
    { value: 'react-vite', label: 'React + Vite (TS)', description: 'TypeScript React with Vite', icon: Code },
    { value: 'nextjs', label: 'Next.js (TS)', description: 'TypeScript Next.js framework', icon: Globe },
    { value: 'express', label: 'Express.js (TS)', description: 'TypeScript Express server', icon: Server },
    { value: 'node', label: 'Node.js (TS)', description: 'TypeScript Node.js runtime', icon: Zap },
  ],
  python: [
    { value: 'flask', label: 'Flask', description: 'Lightweight Python web framework', icon: Server },
    { value: 'django', label: 'Django', description: 'Full-featured Python web framework', icon: Globe },
    { value: 'fastapi', label: 'FastAPI', description: 'Modern Python API framework', icon: Zap },
  ],
  java: [
    { value: 'spring-boot', label: 'Spring Boot', description: 'Enterprise Java framework', icon: Coffee },
    { value: 'spring-mvc', label: 'Spring MVC', description: 'Java MVC web framework', icon: Server },
  ],
};

export function NewProjectModal({ open, onOpenChange, onProjectCreated }: NewProjectModalProps) {
  const [projectName, setProjectName] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedFramework, setSelectedFramework] = useState("");
  const queryClient = useQueryClient();

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/projects/create", {
        projectName: projectName.trim(),
        language: selectedLanguage,
        framework: selectedFramework,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/files"] });
      onProjectCreated?.(data);
      onOpenChange(false);
      // Reset form
      setProjectName("");
      setSelectedLanguage("");
      setSelectedFramework("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim() && selectedLanguage && selectedFramework) {
      createProjectMutation.mutate();
    }
  };

  const availableFrameworks = selectedLanguage ? frameworksByLanguage[selectedLanguage] || [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Create New Project
          </DialogTitle>
          <DialogDescription>
            Set up a new project with the framework structure of your choice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              placeholder="my-awesome-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={createProjectMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Programming Language</Label>
            <Select
              value={selectedLanguage}
              onValueChange={(value) => {
                setSelectedLanguage(value);
                setSelectedFramework(""); // Reset framework when language changes
              }}
              disabled={createProjectMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a programming language" />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <div className="flex items-center gap-2">
                      <span>{lang.icon}</span>
                      {lang.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Framework</Label>
            <Select
              value={selectedFramework}
              onValueChange={setSelectedFramework}
              disabled={!selectedLanguage || createProjectMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a framework" />
              </SelectTrigger>
              <SelectContent>
                {availableFrameworks.map((framework) => (
                  <SelectItem key={framework.value} value={framework.value}>
                    <div className="flex items-center gap-3">
                      <framework.icon className="w-4 h-4" />
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{framework.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {framework.description}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLanguage && selectedFramework && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <Database className="w-4 h-4" />
                <span className="font-medium">Project Structure Preview</span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                This will create a complete {frameworksByLanguage[selectedLanguage].find(f => f.value === selectedFramework)?.label} project 
                with proper folder structure, configuration files, and starter code.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createProjectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!projectName.trim() || !selectedLanguage || !selectedFramework || createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Code className="w-4 h-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
