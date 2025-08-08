import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Github, 
  GitBranch, 
  Lock, 
  Unlock, 
  Download, 
  FolderGit2,
  Plus,
  RefreshCw
} from "lucide-react";
import { Repository, GitHubUser } from "@/types/github";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RepositoryManagerProps {
  currentUser: GitHubUser;
  onRepositorySelect: (repository: Repository) => void;
  selectedRepository: Repository | null;
}

export function RepositoryManager({ 
  currentUser, 
  onRepositorySelect, 
  selectedRepository 
}: RepositoryManagerProps) {
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [repositoryToClone, setRepositoryToClone] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: localRepositories = [], isLoading: loadingLocal } = useQuery<Repository[]>({
    queryKey: ["/api/repositories", currentUser.id],
    refetchOnWindowFocus: false,
  });

  const { data: githubRepositories = [], isLoading: loadingGitHub, refetch: refetchGitHub } = useQuery({
    queryKey: ["/api/repositories/github", currentUser.id],
    refetchOnWindowFocus: false,
  });

  const cloneRepositoryMutation = useMutation({
    mutationFn: async ({ repository, userId }: { repository: any; userId: string }) => {
      const createResponse = await apiRequest("POST", "/api/repositories", {
        userId,
        githubId: repository.id.toString(),
        name: repository.name,
        fullName: repository.full_name,
        description: repository.description,
        private: repository.private,
        cloneUrl: repository.clone_url,
        defaultBranch: repository.default_branch,
        isCloned: false,
        localPath: null,
      });
      
      const createdRepo = await createResponse.json();
      
      const cloneResponse = await apiRequest("POST", "/api/repositories/clone", {
        repositoryId: createdRepo.id,
        userId,
      });
      
      return cloneResponse.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/files"] });
      setShowCloneDialog(false);
      setRepositoryToClone(null);
      onRepositorySelect(data.repository);
      toast({
        title: "Repository cloned",
        description: `${data.repository.name} has been cloned successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Clone failed",
        description: "Failed to clone repository",
        variant: "destructive",
      });
    },
  });

  const handleCloneClick = (repository: any) => {
    setRepositoryToClone(repository);
    setShowCloneDialog(true);
  };

  const confirmClone = () => {
    if (repositoryToClone) {
      cloneRepositoryMutation.mutate({
        repository: repositoryToClone,
        userId: currentUser.id,
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FolderGit2 className="w-5 h-5" />
                <span>Local Repositories</span>
              </CardTitle>
              <CardDescription>
                Repositories cloned to your workspace
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLocal ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 dark:bg-slate-700 rounded-lg h-16" />
              ))}
            </div>
          ) : localRepositories.length === 0 ? (
            <div className="text-center py-8">
              <FolderGit2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 dark:text-gray-400">
                No repositories cloned yet
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Clone a repository from GitHub to get started
              </p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {localRepositories.map((repo) => (
                  <div
                    key={repo.id}
                    className={cn(
                      "p-4 border rounded-lg cursor-pointer transition-colors",
                      selectedRepository?.id === repo.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600"
                    )}
                    onClick={() => onRepositorySelect(repo)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {repo.name}
                          </h3>
                          {repo.private ? (
                            <Lock className="w-4 h-4 text-gray-500" />
                          ) : (
                            <Unlock className="w-4 h-4 text-gray-500" />
                          )}
                          {repo.isCloned && (
                            <Badge variant="secondary" className="text-xs">
                              Cloned
                            </Badge>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center space-x-1">
                            <GitBranch className="w-3 h-3" />
                            <span>{repo.defaultBranch}</span>
                          </span>
                          <span>Updated {formatDate(repo.updatedAt.toString())}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Github className="w-5 h-5" />
                <span>GitHub Repositories</span>
              </CardTitle>
              <CardDescription>
                Your repositories on GitHub
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchGitHub()}
              disabled={loadingGitHub}
            >
              <RefreshCw className={cn("w-4 h-4", loadingGitHub && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingGitHub ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 dark:bg-slate-700 rounded-lg h-16" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {githubRepositories.map((repo: any) => {
                  const isCloned = localRepositories.some(local => local.githubId === repo.id.toString());
                  
                  return (
                    <div
                      key={repo.id}
                      className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {repo.name}
                            </h3>
                            {repo.private ? (
                              <Lock className="w-4 h-4 text-gray-500" />
                            ) : (
                              <Unlock className="w-4 h-4 text-gray-500" />
                            )}
                            {isCloned && (
                              <Badge variant="secondary" className="text-xs">
                                Cloned
                              </Badge>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center space-x-1">
                              <GitBranch className="w-3 h-3" />
                              <span>{repo.default_branch}</span>
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {!isCloned && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCloneClick(repo)}
                              disabled={cloneRepositoryMutation.isPending}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Clone
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Repository</DialogTitle>
            <DialogDescription>
              Are you sure you want to clone "{repositoryToClone?.name}" to your workspace?
            </DialogDescription>
          </DialogHeader>
          
          {repositoryToClone && (
            <div className="space-y-2">
              <p className="text-sm"><strong>Repository:</strong> {repositoryToClone.full_name}</p>
              {repositoryToClone.description && (
                <p className="text-sm"><strong>Description:</strong> {repositoryToClone.description}</p>
              )}
              <p className="text-sm"><strong>Branch:</strong> {repositoryToClone.default_branch}</p>
              <p className="text-sm"><strong>Visibility:</strong> {repositoryToClone.private ? 'Private' : 'Public'}</p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloneDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmClone}
              disabled={cloneRepositoryMutation.isPending}
            >
              {cloneRepositoryMutation.isPending ? "Cloning..." : "Clone Repository"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}