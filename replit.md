# Overview

This is a full-stack AI-powered coding assistant application built with React frontend and Express backend. The application allows users to have conversations with an AI assistant (Google Gemini) about coding topics, with support for syntax highlighting, code block rendering, and chat management. The app features a modern UI built with shadcn/ui components and supports both light and dark themes.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Theme System**: Custom theme provider supporting light/dark modes with localStorage persistence

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **API Design**: RESTful API with JSON responses
- **Validation**: Zod schemas for request/response validation
- **Storage Layer**: Abstracted storage interface with in-memory implementation for development

## Database Schema
- **Chats Table**: Stores chat sessions with title, programming language, and timestamps
- **Messages Table**: Stores individual messages with role (user/assistant), content, and foreign key to chats
- **Migration Strategy**: Drizzle Kit for schema migrations and database management

## Authentication & External Services
- **AI Integration**: Google Gemini AI API for code generation and assistance
- **API Key Management**: Client-side storage of Gemini API keys with validation
- **No Traditional Auth**: Application relies on API key validation rather than user accounts

## Development Architecture
- **Monorepo Structure**: Client, server, and shared code in separate directories
- **Shared Types**: Common TypeScript types and schemas in shared directory
- **Hot Reload**: Vite HMR for frontend development with Express server proxy
- **Build Process**: Separate builds for client (Vite) and server (esbuild)

## Key Design Patterns
- **Separation of Concerns**: Clear separation between data access, business logic, and presentation
- **Type Safety**: End-to-end TypeScript with shared schemas between frontend and backend
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Error Handling**: Comprehensive error boundaries and user feedback systems
- **Code Organization**: Feature-based component structure with reusable UI components

# External Dependencies

## Core Framework Dependencies
- **@google/genai**: Google Gemini AI integration for code assistance
- **@neondatabase/serverless**: PostgreSQL database connection for Neon
- **drizzle-orm**: Type-safe ORM for database operations
- **express**: Node.js web framework for REST API

## Frontend UI Dependencies
- **@radix-ui/***: Comprehensive set of unstyled UI primitives
- **@tanstack/react-query**: Server state management and caching
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight routing library
- **class-variance-authority**: Utility for creating variant-based component APIs

## Development Tools
- **vite**: Fast build tool and development server
- **typescript**: Static type checking
- **drizzle-kit**: Database schema management and migrations
- **esbuild**: Fast JavaScript bundler for server builds

## Database & Infrastructure
- **PostgreSQL**: Primary database (via Neon)
- **Neon Database**: Serverless PostgreSQL platform
- **Environment Variables**: DATABASE_URL for database connection, API keys for external services