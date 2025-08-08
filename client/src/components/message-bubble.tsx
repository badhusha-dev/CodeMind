import { Message } from "@/types/chat";
import { Bot, User } from "lucide-react";
import { CodeBlock } from "./code-block";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
}

const parseMessageContent = (content: string) => {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts: Array<{ type: "text" | "code"; content: string; language?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        parts.push({ type: "text", content: textContent });
      }
    }

    // Add code block
    parts.push({
      type: "code",
      content: match[2],
      language: match[1] || "text",
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      parts.push({ type: "text", content: textContent });
    }
  }

  return parts.length > 0 ? parts : [{ type: "text", content }];
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const parsedContent = parseMessageContent(message.content);

  return (
    <div className={cn("flex items-start space-x-3", isUser && "justify-end")}>
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={cn("flex-1 max-w-3xl", isUser && "max-w-2xl")}>
        <div
          className={cn(
            "rounded-lg p-4",
            isUser
              ? "bg-blue-600 text-white ml-12"
              : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
          )}
        >
          {parsedContent.map((part, index) => (
            <div key={index} className={index > 0 ? "mt-4" : ""}>
              {part.type === "code" ? (
                <CodeBlock code={part.content} language={"language" in part ? part.language || "text" : "text"} />
              ) : (
                <div
                  className={cn(
                    "prose prose-sm max-w-none",
                    isUser
                      ? "prose-invert"
                      : "prose-gray dark:prose-invert"
                  )}
                  dangerouslySetInnerHTML={{
                    __html: part.content.replace(/\n/g, "<br>"),
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <div className={cn("text-xs text-gray-500 mt-1", isUser && "text-right")}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {isUser && (
        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </div>
      )}
    </div>
  );
}
