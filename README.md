
# AI-Powered GitHub IDE

A full-stack web application that combines the power of AI assistance with GitHub integration and code editing capabilities. Built with React, Express.js, and Google Gemini AI.

![AI GitHub IDE](https://img.shields.io/badge/AI-Powered-brightgreen) ![GitHub Integration](https://img.shields.io/badge/GitHub-Integration-blue) ![React](https://img.shields.io/badge/React-18-61dafb) ![Express](https://img.shields.io/badge/Express-4.x-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

## 🚀 Features

### Core Functionality
- **AI-Powered Code Assistant** - Chat with Google Gemini AI for coding help, debugging, and explanations
- **GitHub Integration** - OAuth authentication, repository cloning, and management
- **Monaco Code Editor** - Professional code editing with syntax highlighting and IntelliSense
- **File Explorer** - Browse and manage project files with Git status indicators
- **Project Download** - Export your entire workspace as a ZIP file
- **Real-time Chat** - Interactive AI conversations with code block rendering

### Technical Features
- **API Usage Tracking** - Monitor Gemini API usage, token consumption, and rate limits
- **Syntax Highlighting** - Support for multiple programming languages
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Dark/Light Theme** - Toggle between themes with system preference detection
- **Type Safety** - End-to-end TypeScript implementation

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **shadcn/ui** components built on Radix UI
- **Monaco Editor** for code editing
- **TanStack Query** for state management
- **Wouter** for lightweight routing

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** with Drizzle ORM
- **Neon Database** for serverless PostgreSQL
- **Google Gemini AI** for AI capabilities
- **GitHub OAuth** for authentication

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/ai-github-ide.git
   cd ai-github-ide
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL=your_neon_database_url
   
   # AI API
   GEMINI_API_KEY=your_gemini_api_key
   
   # GitHub OAuth
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   
   # App Configuration
   PORT=5000
   NODE_ENV=development
   ```

4. **Run database migrations:**
   ```bash
   npm run db:push
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 🔧 Usage

### Getting Started
1. **API Key Setup** - Add your Google Gemini API key in the settings
2. **GitHub Authentication** - Connect your GitHub account for repository access
3. **Start Coding** - Create a new chat or clone a repository to begin

### Key Features

#### AI Assistant
- Ask coding questions and get intelligent responses
- Request code generation for specific requirements
- Get debugging help and optimization suggestions
- Receive explanations for complex programming concepts

#### GitHub Integration
- **OAuth Login** - Secure authentication with GitHub
- **Repository Management** - Clone, browse, and manage repositories
- **File Operations** - Edit files directly in the browser
- **Git Status** - View file changes and Git status indicators

#### Code Editor
- **Syntax Highlighting** - Support for 100+ programming languages
- **IntelliSense** - Intelligent code completion
- **Find & Replace** - Advanced search and replace functionality
- **Multi-tab Support** - Work with multiple files simultaneously

#### Project Management
- **File Explorer** - Navigate your project structure
- **Download Projects** - Export workspace as ZIP
- **Chat History** - Access previous AI conversations
- **Usage Tracking** - Monitor API consumption and limits

## 🎯 API Endpoints

### Chat Management
- `GET /api/chats` - List all chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id` - Get chat details
- `DELETE /api/chats/:id` - Delete chat

### Messages
- `GET /api/chats/:id/messages` - Get chat messages
- `POST /api/chats/:id/messages` - Send message to AI

### GitHub Integration
- `GET /api/auth/github` - GitHub OAuth initiation
- `GET /api/auth/github/callback` - OAuth callback
- `GET /api/github/repos` - List user repositories
- `POST /api/github/clone` - Clone repository

### Workspace
- `GET /api/workspace/files` - List workspace files
- `GET /api/workspace/file` - Read file content
- `POST /api/workspace/file` - Write file content
- `POST /api/workspace/download` - Download project ZIP

### API Usage
- `POST /api/usage-stats` - Get API usage statistics

## 🔒 Environment Configuration

### Required Environment Variables
```env
# Database Connection
DATABASE_URL=postgresql://username:password@host:port/database

# AI Configuration
GEMINI_API_KEY=your_google_gemini_api_key

# GitHub OAuth App
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret

# Server Configuration
PORT=5000
NODE_ENV=production
```

## 📊 Project Structure

```
ai-github-ide/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and config
│   │   └── types/         # TypeScript types
├── server/                # Express backend
│   ├── services/         # Business logic services
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Database operations
│   └── index.ts          # Server entry point
├── shared/               # Shared types and schemas
└── README.md
```

## 🚀 Deployment

### Deploy on Replit
1. Fork this repository on Replit
2. Set up environment variables in Replit Secrets
3. The application will automatically deploy on Replit's infrastructure

### Build for Production
```bash
# Build the application
npm run build

# Start production server
npm run start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Gemini AI** for powerful AI capabilities
- **GitHub** for repository hosting and OAuth
- **Neon Database** for serverless PostgreSQL
- **shadcn/ui** for beautiful UI components
- **Monaco Editor** for professional code editing

## 🐛 Known Issues

- Large repository cloning may timeout
- File upload size limits apply
- Rate limits depend on your Gemini API tier

## 📞 Support

If you encounter any issues or have questions:
- Create an issue on GitHub
- Check the documentation
- Review the console logs for debugging

---

**Built with ❤️ using React, Express.js, and Google Gemini AI**

*Last updated: January 2025*
