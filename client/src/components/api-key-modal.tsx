import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Shield, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ApiKeyModalProps {
  open: boolean;
  onApiKeySet: (apiKey: string) => void;
}

export function ApiKeyModal({ open, onApiKeySet }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  const validateKeyMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await apiRequest("POST", "/api/validate-key", { apiKey: key });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        localStorage.setItem("gemini_api_key", apiKey);
        onApiKeySet(apiKey);
        setError("");
      } else {
        setError("Invalid API key. Please check your key and try again.");
      }
    },
    onError: () => {
      setError("Failed to validate API key. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }
    setError("");
    validateKeyMutation.mutate(apiKey.trim());
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <DialogTitle className="text-2xl">Welcome to Code AI Agent</DialogTitle>
          <DialogDescription>
            Enter your Google Gemini API key to get started with AI-powered coding assistance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Gemini API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your Gemini API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={validateKeyMutation.isPending}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">Your API key is stored locally</div>
              <div className="text-sm">
                We never send your API key to our servers. It's stored securely in your browser's local storage.
              </div>
            </AlertDescription>
          </Alert>

          <Button
            type="submit"
            className="w-full"
            disabled={validateKeyMutation.isPending || !apiKey.trim()}
          >
            {validateKeyMutation.isPending ? "Validating..." : "Continue"}
          </Button>
        </form>

        <div className="text-center">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Don't have an API key? Get one from Google AI Studio
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
