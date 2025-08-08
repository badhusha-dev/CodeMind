import * as fs from "fs/promises";
import * as path from "path";
import archiver from "archiver";

export async function createProjectZip(
  projectPath: string,
  projectName: string,
  includeGit = false
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
        ignore: includeGit ? ["node_modules/**", "*.log", ".env*"] : ["node_modules/**", ".git/**", "*.log", ".env*"],
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

export interface ProjectFile {
  path: string;
  content: string;
  type: 'file' | 'directory';
}

export interface ProjectStructure {
  language: string;
  framework: string;
  files: ProjectFile[];
  installCommand?: string;
  runCommand?: string;
  devCommand?: string;
}

export async function createFrameworkStructure(
  language: string,
  framework: string,
  projectName: string
): Promise<ProjectStructure> {
  const structures: Record<string, Record<string, () => ProjectStructure>> = {
    javascript: {
      react: () => createReactStructure(projectName),
      'react-vite': () => createReactViteStructure(projectName),
      'nextjs': () => createNextJsStructure(projectName),
      'express': () => createExpressStructure(projectName),
      'node': () => createNodeJsStructure(projectName),
    },
    typescript: {
      react: () => createReactTsStructure(projectName),
      'react-vite': () => createReactViteTsStructure(projectName),
      'nextjs': () => createNextJsTsStructure(projectName),
      'express': () => createExpressTsStructure(projectName),
      'node': () => createNodeJsTsStructure(projectName),
    },
    python: {
      flask: () => createFlaskStructure(projectName),
      django: () => createDjangoStructure(projectName),
      fastapi: () => createFastApiStructure(projectName),
    },
    java: {
      'spring-boot': () => createSpringBootStructure(projectName),
      'spring-mvc': () => createSpringMvcStructure(projectName),
    },
  };

  const frameworkCreator = structures[language]?.[framework];
  if (!frameworkCreator) {
    throw new Error(`Framework ${framework} not supported for language ${language}`);
  }

  return frameworkCreator();
}

function createReactViteStructure(projectName: string): ProjectStructure {
  return {
    language: 'javascript',
    framework: 'react-vite',
    installCommand: 'npm install',
    runCommand: 'npm run dev',
    devCommand: 'npm run dev',
    files: [
      {
        path: 'package.json',
        type: 'file',
        content: JSON.stringify({
          name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          private: true,
          version: '0.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            lint: 'eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0',
            preview: 'vite preview'
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0'
          },
          devDependencies: {
            '@types/react': '^18.2.66',
            '@types/react-dom': '^18.2.22',
            '@vitejs/plugin-react': '^4.2.1',
            eslint: '^8.57.0',
            'eslint-plugin-react': '^7.34.1',
            'eslint-plugin-react-hooks': '^4.6.0',
            'eslint-plugin-react-refresh': '^0.4.6',
            vite: '^5.2.0'
          }
        }, null, 2)
      },
      {
        path: 'index.html',
        type: 'file',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
      },
      {
        path: 'vite.config.js',
        type: 'file',
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000
  }
})`
      },
      {
        path: 'src/main.jsx',
        type: 'file',
        content: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`
      },
      {
        path: 'src/App.jsx',
        type: 'file',
        content: `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <header className="App-header">
        <h1>${projectName}</h1>
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
          <p>
            Edit <code>src/App.jsx</code> and save to test HMR
          </p>
        </div>
      </header>
    </div>
  )
}

export default App`
      },
      {
        path: 'src/App.css',
        type: 'file',
        content: `.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
}

.card {
  padding: 2em;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  color: white;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}

button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}`
      },
      {
        path: 'src/index.css',
        type: 'file',
        content: `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}`
      },
      {
        path: 'src/components/.gitkeep',
        type: 'file',
        content: ''
      },
      {
        path: 'public/vite.svg',
        type: 'file',
        content: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFEA83"></stop><stop offset="8.333%" stop-color="#FFDD35"></stop><stop offset="100%" stop-color="#FFA800"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>`
      },
      {
        path: '.gitignore',
        type: 'file',
        content: `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?`
      },
      {
        path: 'README.md',
        type: 'file',
        content: `# ${projectName}

A React application built with Vite and powered by AI assistance.

## Getting Started

### Prerequisites
- Node.js 16.x or higher
- npm or yarn

### Installation
\`\`\`bash
npm install
\`\`\`

### Development
\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:5000](http://localhost:5000) to view it in your browser.

### Build
\`\`\`bash
npm run build
\`\`\`

### Preview Production Build
\`\`\`bash
npm run preview
\`\`\`

## Project Structure
\`\`\`
${projectName}/
├── public/          # Static assets
├── src/
│   ├── components/  # React components
│   ├── App.jsx      # Main App component
│   ├── main.jsx     # Entry point
│   └── index.css    # Global styles
├── index.html       # HTML template
├── package.json     # Dependencies
└── vite.config.js   # Vite configuration
\`\`\`

## AI-Generated
This project was created with Code AI Agent and includes framework-specific structure for immediate development.`
      }
    ]
  };
}

function createExpressStructure(projectName: string): ProjectStructure {
  return {
    language: 'javascript',
    framework: 'express',
    installCommand: 'npm install',
    runCommand: 'npm start',
    devCommand: 'npm run dev',
    files: [
      {
        path: 'package.json',
        type: 'file',
        content: JSON.stringify({
          name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          version: '1.0.0',
          description: 'Express.js application',
          main: 'server.js',
          scripts: {
            start: 'node server.js',
            dev: 'nodemon server.js',
            test: 'echo "Error: no test specified" && exit 1'
          },
          dependencies: {
            express: '^4.18.2',
            cors: '^2.8.5',
            dotenv: '^16.3.1'
          },
          devDependencies: {
            nodemon: '^3.0.1'
          }
        }, null, 2)
      },
      {
        path: 'server.js',
        type: 'file',
        content: `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ${projectName} API!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
});`
      },
      {
        path: 'routes/api.js',
        type: 'file',
        content: `const express = require('express');
const router = express.Router();

// Sample API route
router.get('/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' }
  ]);
});

module.exports = router;`
      },
      {
        path: 'middleware/auth.js',
        type: 'file',
        content: `// Authentication middleware
const authenticateToken = (req, res, next) => {
  // Add your authentication logic here
  next();
};

module.exports = { authenticateToken };`
      },
      {
        path: '.env',
        type: 'file',
        content: `PORT=5000
NODE_ENV=development
# Add your environment variables here`
      },
      {
        path: '.gitignore',
        type: 'file',
        content: `node_modules
*.log
.env
.DS_Store
dist/`
      },
      {
        path: 'README.md',
        type: 'file',
        content: `# ${projectName}

Express.js API server built with AI assistance.

## Getting Started

### Installation
\`\`\`bash
npm install
\`\`\`

### Development
\`\`\`bash
npm run dev
\`\`\`

### Production
\`\`\`bash
npm start
\`\`\`

## API Endpoints

- \`GET /\` - Welcome message
- \`GET /api/health\` - Health check

## Project Structure
\`\`\`
${projectName}/
├── routes/          # API routes
├── middleware/      # Express middleware
├── server.js        # Main server file
├── package.json     # Dependencies
└── .env            # Environment variables
\`\`\`

Server runs on http://localhost:5000`
      }
    ]
  };
}

function createFlaskStructure(projectName: string): ProjectStructure {
  return {
    language: 'python',
    framework: 'flask',
    installCommand: 'pip install -r requirements.txt',
    runCommand: 'python app.py',
    devCommand: 'flask run --debug',
    files: [
      {
        path: 'app.py',
        type: 'file',
        content: `from flask import Flask, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return jsonify({
        'message': 'Welcome to ${projectName} API!',
        'status': 'running'
    })

@app.route('/api/health')
def health():
    return jsonify({
        'status': 'OK',
        'service': '${projectName}'
    })

@app.route('/api/users', methods=['GET'])
def get_users():
    users = [
        {'id': 1, 'name': 'John Doe'},
        {'id': 2, 'name': 'Jane Smith'}
    ]
    return jsonify(users)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)`
      },
      {
        path: 'requirements.txt',
        type: 'file',
        content: `Flask==2.3.3
Flask-CORS==4.0.0
python-dotenv==1.0.0`
      },
      {
        path: 'config.py',
        type: 'file',
        content: `import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
class DevelopmentConfig(Config):
    DEBUG = True
    
class ProductionConfig(Config):
    DEBUG = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}`
      },
      {
        path: 'routes/__init__.py',
        type: 'file',
        content: ''
      },
      {
        path: 'routes/api.py',
        type: 'file',
        content: `from flask import Blueprint, jsonify, request

api_bp = Blueprint('api', __name__)

@api_bp.route('/data')
def get_data():
    return jsonify({
        'data': 'Sample data from API route',
        'timestamp': '2024-01-01T00:00:00Z'
    })`
      },
      {
        path: 'templates/index.html',
        type: 'file',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
</head>
<body>
    <div class="container">
        <h1>Welcome to ${projectName}</h1>
        <p>Flask application powered by AI</p>
    </div>
</body>
</html>`
      },
      {
        path: 'static/css/style.css',
        type: 'file',
        content: `body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
}

.container {
    max-width: 800px;
    margin: 50px auto;
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    text-align: center;
}

h1 {
    color: #333;
    margin-bottom: 20px;
}

p {
    color: #666;
    font-size: 18px;
}`
      },
      {
        path: '.env',
        type: 'file',
        content: `FLASK_APP=app.py
FLASK_DEBUG=True
SECRET_KEY=your-secret-key-here
PORT=5000`
      },
      {
        path: '.gitignore',
        type: 'file',
        content: `__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
env.bak/
venv.bak/
.env
.venv
pip-log.txt
pip-delete-this-directory.txt
.DS_Store`
      },
      {
        path: 'README.md',
        type: 'file',
        content: `# ${projectName}

Flask web application built with AI assistance.

## Getting Started

### Prerequisites
- Python 3.7+
- pip

### Installation
\`\`\`bash
pip install -r requirements.txt
\`\`\`

### Development
\`\`\`bash
python app.py
\`\`\`

Or with Flask CLI:
\`\`\`bash
flask run --debug
\`\`\`

## API Endpoints

- \`GET /\` - Welcome message
- \`GET /api/health\` - Health check
- \`GET /api/users\` - Sample users data

## Project Structure
\`\`\`
${projectName}/
├── routes/          # Blueprint routes
├── templates/       # Jinja2 templates
├── static/          # Static files (CSS, JS, images)
├── app.py          # Main application file
├── config.py       # Configuration settings
└── requirements.txt # Python dependencies
\`\`\`

Server runs on http://localhost:5000`
      }
    ]
  };
}

function createSpringBootStructure(projectName: string): ProjectStructure {
  const packageName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    language: 'java',
    framework: 'spring-boot',
    installCommand: 'mvn clean install',
    runCommand: 'mvn spring-boot:run',
    devCommand: 'mvn spring-boot:run',
    files: [
      {
        path: 'pom.xml',
        type: 'file',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
        <relativePath/>
    </parent>
    
    <groupId>com.example</groupId>
    <artifactId>${packageName}</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>${projectName}</name>
    <description>Spring Boot application</description>
    
    <properties>
        <java.version>17</java.version>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>com.h2database</groupId>
            <artifactId>h2</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>`
      },
      {
        path: `src/main/java/com/example/${packageName}/Application.java`,
        type: 'file',
        content: `package com.example.${packageName};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}`
      },
      {
        path: `src/main/java/com/example/${packageName}/controller/HomeController.java`,
        type: 'file',
        content: `package com.example.${packageName}.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;
import java.util.HashMap;

@RestController
public class HomeController {
    
    @GetMapping("/")
    public Map<String, String> home() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Welcome to ${projectName} API!");
        response.put("status", "running");
        return response;
    }
    
    @GetMapping("/api/health")
    public Map<String, String> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "OK");
        response.put("service", "${projectName}");
        return response;
    }
}`
      },
      {
        path: `src/main/java/com/example/${packageName}/model/User.java`,
        type: 'file',
        content: `package com.example.${packageName}.model;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String name;
    private String email;
    
    // Constructors
    public User() {}
    
    public User(String name, String email) {
        this.name = name;
        this.email = email;
    }
    
    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}`
      },
      {
        path: 'src/main/resources/application.properties',
        type: 'file',
        content: `server.port=5000
server.address=0.0.0.0

# H2 Database configuration
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driverClassName=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=password
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.h2.console.enabled=true
spring.jpa.hibernate.ddl-auto=create-drop

# Logging
logging.level.com.example.${packageName}=DEBUG`
      },
      {
        path: '.gitignore',
        type: 'file',
        content: `target/
!.mvn/wrapper/maven-wrapper.jar
!**/src/main/**/target/
!**/src/test/**/target/

### IDE ###
.idea
*.iws
*.iml
*.ipr
*.sw?
.vscode/

### OS ###
.DS_Store
Thumbs.db

### Java ###
*.class
*.log
*.ctxt
.mtj.tmp/
*.jar
*.war
*.nar
*.ear
*.zip
*.tar.gz
*.rar
hs_err_pid*`
      },
      {
        path: 'README.md',
        type: 'file',
        content: `# ${projectName}

Spring Boot application built with AI assistance.

## Getting Started

### Prerequisites
- Java 17+
- Maven 3.6+

### Installation & Run
\`\`\`bash
mvn clean install
mvn spring-boot:run
\`\`\`

## API Endpoints

- \`GET /\` - Welcome message
- \`GET /api/health\` - Health check
- \`GET /h2-console\` - H2 Database Console (dev only)

## Project Structure
\`\`\`
${projectName}/
├── src/
│   ├── main/
│   │   ├── java/com/example/${packageName}/
│   │   │   ├── controller/     # REST controllers
│   │   │   ├── model/         # Entity models
│   │   │   └── Application.java
│   │   └── resources/
│   │       └── application.properties
│   └── test/                  # Test files
├── pom.xml                    # Maven dependencies
└── README.md
\`\`\`

Server runs on http://localhost:5000
H2 Console: http://localhost:5000/h2-console`
      }
    ]
  };
}

// Helper functions for other frameworks (React TS, Next.js, etc.)
function createReactStructure(projectName: string): ProjectStructure {
  return createReactViteStructure(projectName);
}

function createReactTsStructure(projectName: string): ProjectStructure {
  const reactStructure = createReactViteStructure(projectName);
  reactStructure.language = 'typescript';
  // Convert JS files to TS and update dependencies
  reactStructure.files = reactStructure.files.map(file => {
    if (file.path.endsWith('.jsx')) {
      return { ...file, path: file.path.replace('.jsx', '.tsx') };
    }
    if (file.path.endsWith('.js') && !file.path.includes('vite.config')) {
      return { ...file, path: file.path.replace('.js', '.ts') };
    }
    return file;
  });
  
  // Update package.json for TypeScript
  const packageJsonFile = reactStructure.files.find(f => f.path === 'package.json');
  if (packageJsonFile) {
    const pkg = JSON.parse(packageJsonFile.content);
    pkg.devDependencies = {
      ...pkg.devDependencies,
      typescript: '^5.0.2',
      '@types/react': '^18.2.66',
      '@types/react-dom': '^18.2.22'
    };
    packageJsonFile.content = JSON.stringify(pkg, null, 2);
  }
  
  return reactStructure;
}

function createReactViteTsStructure(projectName: string): ProjectStructure {
  return createReactTsStructure(projectName);
}

function createNextJsStructure(projectName: string): ProjectStructure {
  return {
    language: 'javascript',
    framework: 'nextjs',
    installCommand: 'npm install',
    runCommand: 'npm run dev',
    devCommand: 'npm run dev',
    files: [
      // Add Next.js structure here - abbreviated for space
      {
        path: 'package.json',
        type: 'file',
        content: JSON.stringify({
          name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev -p 5000',
            build: 'next build',
            start: 'next start',
            lint: 'next lint'
          },
          dependencies: {
            next: '14.0.0',
            react: '^18',
            'react-dom': '^18'
          }
        }, null, 2)
      },
      // Add more Next.js files...
    ]
  };
}

// Implement other framework creators...
function createNextJsTsStructure(projectName: string): ProjectStructure {
  const nextStructure = createNextJsStructure(projectName);
  nextStructure.language = 'typescript';
  return nextStructure;
}

function createExpressTsStructure(projectName: string): ProjectStructure {
  const expressStructure = createExpressStructure(projectName);
  expressStructure.language = 'typescript';
  return expressStructure;
}

function createNodeJsStructure(projectName: string): ProjectStructure {
  return createExpressStructure(projectName);
}

function createNodeJsTsStructure(projectName: string): ProjectStructure {
  return createExpressTsStructure(projectName);
}

function createDjangoStructure(projectName: string): ProjectStructure {
  const flaskStructure = createFlaskStructure(projectName);
  flaskStructure.framework = 'django';
  return flaskStructure;
}

function createFastApiStructure(projectName: string): ProjectStructure {
  const flaskStructure = createFlaskStructure(projectName);
  flaskStructure.framework = 'fastapi';
  return flaskStructure;
}

function createSpringMvcStructure(projectName: string): ProjectStructure {
  const springStructure = createSpringBootStructure(projectName);
  springStructure.framework = 'spring-mvc';
  return springStructure;
}

export async function createFrameworkProjectZip(
  messages: any[],
  projectName: string,
  language: string,
  framework: string
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

      // Create framework structure
      const projectStructure = await createFrameworkStructure(language, framework, projectName);
      
      // Add framework files to archive
      for (const file of projectStructure.files) {
        archive.append(file.content, { name: `${projectName}/${file.path}` });
      }

      // Extract and add AI-generated code to appropriate directories
      const extractedFiles = extractCodeFromMessages(messages);
      for (const file of extractedFiles) {
        const frameworkAwarePath = getFrameworkAwarePath(file, language, framework);
        archive.append(file.content, { name: `${projectName}/${frameworkAwarePath}` });
      }

      // Add enhanced README with framework info
      const enhancedReadme = generateFrameworkReadme(projectName, projectStructure, extractedFiles.length);
      archive.append(enhancedReadme, { name: `${projectName}/README.md` });

      // Add chat history
      const chatHistory = generateChatHistory(messages);
      archive.append(chatHistory, { name: `${projectName}/CHAT_HISTORY.md` });

      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

function getFrameworkAwarePath(file: {path: string, content: string, language: string}, projectLanguage: string, framework: string): string {
  const { path, content, language } = file;
  
  // Framework-specific path mapping
  const pathMappings: Record<string, Record<string, (filename: string) => string>> = {
    javascript: {
      'react-vite': (filename) => {
        if (filename.endsWith('.jsx') || filename.endsWith('.tsx')) {
          return `src/components/${filename}`;
        }
        if (filename.endsWith('.css')) {
          return `src/styles/${filename}`;
        }
        if (filename.endsWith('.js') || filename.endsWith('.ts')) {
          return `src/${filename}`;
        }
        return filename;
      },
      express: (filename) => {
        if (filename.includes('route') || filename.includes('api')) {
          return `routes/${filename}`;
        }
        if (filename.includes('middleware')) {
          return `middleware/${filename}`;
        }
        if (filename.includes('model')) {
          return `models/${filename}`;
        }
        return filename;
      },
      nextjs: (filename) => {
        if (filename.endsWith('.jsx') || filename.endsWith('.tsx')) {
          if (filename.includes('page') || filename.includes('index')) {
            return `pages/${filename}`;
          }
          return `components/${filename}`;
        }
        return filename;
      }
    },
    python: {
      flask: (filename) => {
        if (filename.includes('route') || filename.includes('view')) {
          return `routes/${filename}`;
        }
        if (filename.includes('model')) {
          return `models/${filename}`;
        }
        if (filename.endsWith('.html')) {
          return `templates/${filename}`;
        }
        if (filename.endsWith('.css')) {
          return `static/css/${filename}`;
        }
        return filename;
      }
    },
    java: {
      'spring-boot': (filename) => {
        if (filename.includes('Controller')) {
          return `src/main/java/com/example/controller/${filename}`;
        }
        if (filename.includes('Service')) {
          return `src/main/java/com/example/service/${filename}`;
        }
        if (filename.includes('Model') || filename.includes('Entity')) {
          return `src/main/java/com/example/model/${filename}`;
        }
        if (filename.endsWith('.properties')) {
          return `src/main/resources/${filename}`;
        }
        return filename;
      }
    }
  };
  
  const mapping = pathMappings[projectLanguage]?.[framework];
  return mapping ? mapping(path) : path;
}

function generateFrameworkReadme(projectName: string, projectStructure: ProjectStructure, aiFileCount: number): string {
  return `# ${projectName}

${projectStructure.framework} application built with AI assistance.

## 🚀 Quick Start

### Prerequisites
- ${projectStructure.language === 'javascript' || projectStructure.language === 'typescript' ? 'Node.js 16+' : ''}
${projectStructure.language === 'python' ? '- Python 3.7+' : ''}
${projectStructure.language === 'java' ? '- Java 17+\n- Maven 3.6+' : ''}

### Installation
\`\`\`bash
${projectStructure.installCommand}
\`\`\`

### Development
\`\`\`bash
${projectStructure.devCommand}
\`\`\`

### Production
\`\`\`bash
${projectStructure.runCommand}
\`\`\`

## 📁 Project Structure

This project follows the standard ${projectStructure.framework} structure with ${aiFileCount} AI-generated files integrated.

## 🤖 AI-Generated Content

- **${aiFileCount} code files** extracted from AI conversations
- **Framework structure** automatically generated for ${projectStructure.framework}
- **Dependencies** configured for immediate development
- **Chat history** preserved in CHAT_HISTORY.md

## 🛠️ Built With

- **${projectStructure.framework}** - ${projectStructure.language} framework
- **Code AI Agent** - AI-powered code generation
- **Google Gemini** - Advanced AI model

---

*Generated by Code AI Agent - From conversation to working code!*`;
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