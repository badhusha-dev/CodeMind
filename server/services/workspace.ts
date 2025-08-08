import * as fs from "fs/promises";
import * as path from "path";
import archiver from "archiver";

export async function createProjectZip(
  projectPath: string,
  projectName: string
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const archive = archiver("zip", { 
        zlib: { level: 9 },
        forceLocalTime: true,
        forceZip64: false
      });
      const chunks: Buffer[] = [];

      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
      archive.on("warning", (err) => {
        if (err.code === "ENOENT") {
          console.warn("Archive warning:", err);
        } else {
          reject(err);
        }
      });

      // Check if project path exists and is accessible
      try {
        await fs.access(projectPath);
      } catch (error) {
        console.warn(`Project path ${projectPath} not accessible, creating empty project`);
        
        // Create basic project structure
        const readme = generateReadme(projectName);
        archive.append(readme, { name: `${projectName}/README.md` });
        
        // Add a basic package.json if it's a Node.js project
        const packageJson = {
          name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          version: "1.0.0",
          description: "AI-generated project",
          main: "index.js",
          scripts: {
            start: "node index.js"
          }
        };
        archive.append(JSON.stringify(packageJson, null, 2), { 
          name: `${projectName}/package.json` 
        });
        
        archive.finalize();
        return;
      }

      // Filter out sensitive and unnecessary files
      const excludePatterns = [
        /node_modules/,
        /\.git$/,
        /\.env/,
        /\.log$/,
        /\.tmp$/,
        /\.cache/,
        /dist$/,
        /build$/,
        /coverage$/,
        /\.nyc_output/,
        /\.DS_Store$/,
        /Thumbs\.db$/
      ];

      // Add project files with filtering
      archive.glob("**/*", {
        cwd: projectPath,
        ignore: ["node_modules/**", ".git/**", "*.log", ".env*"],
        dot: false,
        follow: false
      }, { prefix: projectName });

      // Generate and add README.md
      const readme = generateReadme(projectName);
      archive.append(readme, { name: `${projectName}/README.md` });

      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

export async function createChatProjectZip(
  messages: any[],
  projectName: string
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const archive = archiver("zip", { 
        zlib: { level: 9 },
        forceLocalTime: true,
        forceZip64: false
      });
      const chunks: Buffer[] = [];

      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);

      // Extract code blocks from AI messages
      const extractedFiles = extractCodeFromMessages(messages);
      
      // Add extracted files to archive
      for (const file of extractedFiles) {
        archive.append(file.content, { name: `${projectName}/${file.path}` });
      }

      // Generate and add README.md
      const readme = generateProjectReadme(projectName, extractedFiles.length);
      archive.append(readme, { name: `${projectName}/README.md` });

      // Add chat history as documentation
      const chatHistory = generateChatHistory(messages);
      archive.append(chatHistory, { name: `${projectName}/CHAT_HISTORY.md` });

      // Add package.json for Node.js projects
      if (extractedFiles.some(f => f.path.endsWith('.js') || f.path.endsWith('.ts'))) {
        const packageJson = {
          name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          version: "1.0.0",
          description: "AI-generated project from Code AI Agent",
          main: "index.js",
          scripts: {
            start: "node index.js",
            dev: "node index.js"
          },
          dependencies: detectDependencies(extractedFiles)
        };
        archive.append(JSON.stringify(packageJson, null, 2), { 
          name: `${projectName}/package.json` 
        });
      }

      // Add requirements.txt for Python projects
      if (extractedFiles.some(f => f.path.endsWith('.py'))) {
        const requirements = detectPythonRequirements(extractedFiles);
        if (requirements) {
          archive.append(requirements, { name: `${projectName}/requirements.txt` });
        }
      }

      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

function generateReadme(projectName: string): string {
  return `# ${projectName}

This project was created and enhanced using Code AI Agent.

## About

This repository contains code that has been generated, refactored, and improved with the help of AI assistance.

## Features

- AI-powered code generation
- Intelligent refactoring and optimization
- Automated documentation
- Git integration with AI-assisted commits

## Getting Started

1. Clone this repository
2. Install dependencies (if applicable)
3. Follow the setup instructions in the project files

## AI Assistance

This project was built with the help of AI to:
- Generate boilerplate code
- Implement features and functionality
- Optimize performance and code quality
- Create comprehensive documentation

## Contributing

Feel free to contribute to this project by:
- Reporting bugs
- Suggesting new features
- Submitting pull requests

---

Generated by Code AI Agent - Powered by Google Gemini
`;
}

function generateProjectReadme(projectName: string, fileCount: number): string {
  return `# ${projectName}

This project was created using Code AI Agent with ${fileCount} AI-generated files.

## 🚀 About This Project

This repository contains code that has been generated through conversations with AI. Each file represents solutions, examples, or implementations discussed in the chat sessions.

## 📁 Project Contents

- **${fileCount} code files** extracted from AI conversations
- **Chat history** documenting the development process
- **Dependencies** automatically detected and configured

## 🛠️ Getting Started

### For Node.js Projects
\`\`\`bash
npm install
npm start
\`\`\`

### For Python Projects
\`\`\`bash
pip install -r requirements.txt
python main.py
\`\`\`

## 📝 Documentation

- Check \`CHAT_HISTORY.md\` for the complete conversation history
- Each code file includes the context from which it was generated
- AI-suggested dependencies are included in package configuration files

## 🤖 AI-Generated Content

This project was created with:
- **Google Gemini 2.5 Pro** for code generation
- **Code AI Agent** for project organization
- **Intelligent code extraction** from chat conversations

## 🔧 Features

- Clean, well-documented code
- Proper project structure
- Dependency management
- Ready-to-run examples

---

*Generated by Code AI Agent - Bringing AI conversations to life as working code!*
`;
}

function extractCodeFromMessages(messages: any[]): Array<{path: string, content: string, language: string}> {
  const files: Array<{path: string, content: string, language: string}> = [];
  const seenFiles = new Set<string>();
  
  for (const message of messages) {
    if (message.role === 'assistant') {
      // Extract code blocks using regex
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      let fileIndex = 1;
      
      while ((match = codeBlockRegex.exec(message.content)) !== null) {
        const language = match[1] || 'text';
        const code = match[2].trim();
        
        if (code.length > 20) { // Only include substantial code blocks
          let filename = generateFilename(language, code, fileIndex);
          
          // Ensure unique filenames
          while (seenFiles.has(filename)) {
            fileIndex++;
            filename = generateFilename(language, code, fileIndex);
          }
          
          seenFiles.add(filename);
          files.push({
            path: filename,
            content: code,
            language: language
          });
          fileIndex++;
        }
      }
      
      // Also look for specific file mentions in the text
      const fileRegex = /(?:create|save|write).*?(?:file|to)\s+["'`]?([^\s"'`]+\.\w+)["'`]?/gi;
      let fileMatch;
      
      while ((fileMatch = fileRegex.exec(message.content)) !== null) {
        const suggestedFilename = fileMatch[1];
        if (!seenFiles.has(suggestedFilename)) {
          // Try to find associated code block near this mention
          const nearbyCode = findNearbyCodeBlock(message.content, fileMatch.index);
          if (nearbyCode) {
            seenFiles.add(suggestedFilename);
            files.push({
              path: suggestedFilename,
              content: nearbyCode.code,
              language: nearbyCode.language
            });
          }
        }
      }
    }
  }
  
  return files;
}

function generateFilename(language: string, code: string, index: number): string {
  const extensions: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    csharp: 'cs',
    go: 'go',
    rust: 'rs',
    php: 'php',
    ruby: 'rb',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yml',
    xml: 'xml',
    shell: 'sh',
    bash: 'sh',
    sql: 'sql',
    markdown: 'md'
  };
  
  const ext = extensions[language] || 'txt';
  
  // Try to detect specific patterns for better naming
  if (language === 'javascript' || language === 'typescript') {
    if (code.includes('express') || code.includes('app.listen')) return `server.${ext}`;
    if (code.includes('React') || code.includes('component')) return `component.${ext}`;
    if (code.includes('export default')) return `index.${ext}`;
  }
  
  if (language === 'python') {
    if (code.includes('if __name__ == "__main__"')) return 'main.py';
    if (code.includes('class ')) return `model.py`;
    if (code.includes('def ')) return `utils.py`;
  }
  
  if (language === 'html') return 'index.html';
  if (language === 'css') return 'styles.css';
  if (language === 'json') return 'config.json';
  
  return `file${index}.${ext}`;
}

function findNearbyCodeBlock(content: string, position: number): {code: string, language: string} | null {
  const beforeText = content.substring(Math.max(0, position - 500), position);
  const afterText = content.substring(position, position + 1000);
  
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/;
  let match = codeBlockRegex.exec(afterText);
  
  if (!match) {
    match = codeBlockRegex.exec(beforeText);
  }
  
  if (match && match[2].trim().length > 20) {
    return {
      code: match[2].trim(),
      language: match[1] || 'text'
    };
  }
  
  return null;
}

function generateChatHistory(messages: any[]): string {
  let history = `# Chat History\n\nThis file contains the complete conversation history that generated this project.\n\n`;
  history += `---\n\n`;
  
  for (const message of messages) {
    const role = message.role === 'user' ? '👤 User' : '🤖 AI Assistant';
    const timestamp = new Date(message.timestamp).toLocaleString();
    
    history += `## ${role} - ${timestamp}\n\n`;
    history += `${message.content}\n\n`;
    history += `---\n\n`;
  }
  
  return history;
}

function detectDependencies(files: Array<{path: string, content: string}>): Record<string, string> {
  const dependencies: Record<string, string> = {};
  
  for (const file of files) {
    const content = file.content;
    
    // Detect common Node.js dependencies
    if (content.includes('express')) dependencies.express = '^4.18.0';
    if (content.includes('react')) dependencies.react = '^18.0.0';
    if (content.includes('axios')) dependencies.axios = '^1.6.0';
    if (content.includes('lodash')) dependencies.lodash = '^4.17.0';
    if (content.includes('moment')) dependencies.moment = '^2.29.0';
    if (content.includes('cors')) dependencies.cors = '^2.8.0';
    if (content.includes('dotenv')) dependencies.dotenv = '^16.0.0';
    if (content.includes('mongoose')) dependencies.mongoose = '^8.0.0';
    if (content.includes('socket.io')) dependencies['socket.io'] = '^4.7.0';
  }
  
  return dependencies;
}

function detectPythonRequirements(files: Array<{path: string, content: string}>): string | null {
  const requirements = new Set<string>();
  
  for (const file of files) {
    const content = file.content;
    
    // Detect common Python packages
    if (content.includes('import flask') || content.includes('from flask')) requirements.add('Flask==2.3.0');
    if (content.includes('import django') || content.includes('from django')) requirements.add('Django==4.2.0');
    if (content.includes('import requests') || content.includes('from requests')) requirements.add('requests==2.31.0');
    if (content.includes('import numpy') || content.includes('from numpy')) requirements.add('numpy==1.24.0');
    if (content.includes('import pandas') || content.includes('from pandas')) requirements.add('pandas==2.0.0');
    if (content.includes('import matplotlib') || content.includes('from matplotlib')) requirements.add('matplotlib==3.7.0');
    if (content.includes('import fastapi') || content.includes('from fastapi')) requirements.add('fastapi==0.100.0');
  }
  
  return requirements.size > 0 ? Array.from(requirements).join('\n') : null;
}

export async function saveUploadedFile(
  file: { originalname: string; buffer: Buffer },
  destinationPath: string
): Promise<string> {
  const fileName = file.originalname;
  const filePath = path.join(destinationPath, fileName);
  
  // Ensure destination directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  
  // Write file content
  await fs.writeFile(filePath, file.buffer);
  
  return filePath;
}

export function detectFileLanguage(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const languageMap: Record<string, string> = {
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".py": "python",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "c",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".html": "html",
    ".css": "css",
    ".json": "json",
    ".md": "markdown",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".xml": "xml",
    ".sh": "bash",
  };
  
  return languageMap[ext] || "text";
}