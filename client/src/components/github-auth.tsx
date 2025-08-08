import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { Github, ExternalLink, Loader2 } from "lucide-react";
import { GitHubUser } from "@/types/github";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface GitHubAuthProps {
  onAuthSuccess: (user: GitHubUser) => void;
}

export function GitHubAuth({ onAuthSuccess }: GitHubAuthProps) {
  const { toast } = useToast();

  const getAuthUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/auth/github");
      return response.json();
    },
    onSuccess: (data) => {
      window.open(data.authUrl, "_blank", "width=600,height=700");
      
      // Listen for the auth callback
      window.addEventListener("message", handleAuthCallback);
    },
    onError: () => {
      toast({
        title: "Authentication failed",
        description: "Failed to initialize GitHub authentication",
        variant: "destructive",
      });
    },
  });

  const authenticateMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/auth/github/callback", { code });
      return response.json();
    },
    onSuccess: (data) => {
      onAuthSuccess(data.user);
      toast({
        title: "GitHub connected",
        description: "Successfully connected to your GitHub account",
      });
    },
    onError: () => {
      toast({
        title: "Authentication failed",
        description: "Failed to authenticate with GitHub",
        variant: "destructive",
      });
    },
  });

  const handleAuthCallback = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    
    const { code } = event.data;
    if (code) {
      authenticateMutation.mutate(code);
      window.removeEventListener("message", handleAuthCallback);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
          <Github className="w-8 h-8 text-white" />
        </div>
        <CardTitle>Connect GitHub Account</CardTitle>
        <CardDescription>
          Connect your GitHub account to access your repositories and enable Git operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={() => getAuthUrlMutation.mutate()}
          disabled={getAuthUrlMutation.isPending || authenticateMutation.isPending}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white"
        >
          {getAuthUrlMutation.isPending || authenticateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Github className="w-4 h-4 mr-2" />
              Connect with GitHub
            </>
          )}
        </Button>
        
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>This will open GitHub in a new window</p>
          <p className="flex items-center justify-center mt-1">
            <ExternalLink className="w-3 h-3 mr-1" />
            Safe and secure OAuth authentication
          </p>
        </div>
      </CardContent>
    </Card>
  );
}