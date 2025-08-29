# Healthcare Chatbot Application

## Overview

This is a full-stack healthcare chatbot application that helps users find medical treatments and services through an intelligent conversational interface. The system integrates with an external healthcare API to provide real-time treatment information, pricing, and doctor availability. The application features a modern React frontend with a shadcn/ui component library and an Express.js backend powered by OpenAI for natural language processing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side is built with React and TypeScript, utilizing a modern component-based architecture:
- **UI Framework**: React with TypeScript for type safety
- **Component Library**: shadcn/ui with Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
The server follows a REST API pattern with Express.js:
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints for chat interactions and treatment data
- **AI Integration**: OpenAI GPT-5 for natural language processing and intent analysis
- **Data Processing**: Real-time healthcare API integration with intelligent query parsing
- **Error Handling**: Centralized error handling with proper HTTP status codes

### Database and Schema Design
The application uses a PostgreSQL database with Drizzle ORM:
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema**: User management and chat session storage
- **Migrations**: Drizzle Kit for database schema management
- **Validation**: Zod schemas for runtime type validation

### AI and Natural Language Processing
The system implements intelligent healthcare query processing:
- **Intent Analysis**: Multi-category intent classification (symptoms, treatments, pricing, doctors)
- **Treatment Matching**: Semantic search across healthcare treatment database
- **Response Generation**: Context-aware conversational responses
- **Data Integration**: Real-time fetching and processing of treatment information

### Chat Interface Design
The frontend provides an intuitive conversational experience:
- **Message Flow**: Real-time chat interface with typing indicators
- **Treatment Cards**: Rich display components for treatment information
- **Suggested Queries**: Pre-defined interaction patterns for user guidance
- **Responsive Design**: Mobile-first approach with adaptive layouts

## External Dependencies

### Third-Party Services
- **OpenAI API**: GPT-5 model for natural language processing and conversation management
- **Healthcare API**: External treatment database (pmsapi.healthlantern.com) for real-time medical information
- **Neon Database**: Serverless PostgreSQL hosting for production deployment

### Key Libraries and Frameworks
- **React Ecosystem**: React, TanStack React Query, React Hook Form, Wouter routing
- **UI Components**: Radix UI primitives, shadcn/ui component library, Lucide React icons
- **Styling**: Tailwind CSS, class-variance-authority for component variants
- **Backend**: Express.js, Drizzle ORM, Zod validation
- **Development**: Vite, TypeScript, ESBuild for production builds

### API Integrations
- **Healthcare Data**: RESTful integration with external treatment API for real-time data
- **AI Processing**: OpenAI API integration for intelligent query processing and response generation
- **Database**: PostgreSQL with connection pooling for chat session management