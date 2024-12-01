# SubChat MVP

A full-stack chat application with nested sub-conversations, intelligent memory management, and Chrome built-in AI integration.

## 🌟 Features

- **Nested Sub-Conversations**: Create focused sub-tasks from main conversations
- **Intelligent Memory**: Optional persistent memory using Elastic Search with semantic search
- **Chrome Built-in AI**: Client-side AI processing when available, with server fallback
- **Real-time Streaming**: Server-Sent Events for live AI responses
- **Memory Toggle**: Control whether new conversations use past knowledge
- **Guest Mode**: Demo functionality without account creation
- **Merge & Summarize**: Consolidate sub-chat insights back into main conversations

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (React)       │    │  (Node.js)      │    │   Services      │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Chat UI       │◄──►│ • REST API      │◄──►│ • MongoDB Atlas │
│ • Sub-chat Pane │    │ • SSE Streaming │    │ • Elastic Search│
│ • Memory Banner │    │ • Auth & Users  │    │ • Gemini API    │
│ • Chrome AI     │    │ • Memory Mgmt   │    │ • Chrome AI     │
│ • Settings      │    │ • Admin Tools   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Elastic Search (optional, for memory features)
- Gemini API key

### 1. Clone and Install

```bash
git clone <repository-url>
cd subchat-mvp

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Setup

```bash
# Backend configuration
cd backend
cp .env.example .env
# Edit .env with your actual values

# Frontend configuration (if needed)
cd ../frontend
cp .env.example .env
```

### 3. Start Services

```bash
# Option A: Using Docker (recommended)
cd backend
docker-compose up -d  # Starts MongoDB + Elastic Search
npm run dev           # Start backend server

# Option B: Local services
# Start your local MongoDB and Elastic Search
cd backend
npm run dev

# Start frontend (in another terminal)
cd frontend
npm run dev
```

### 4. Seed Demo Data (Optional)

```bash
cd backend
npm run seed:demo
```

### 5. Test the API

```bash
cd backend
npm run demo:flows
```

## 📁 Project Structure

```
subchat-mvp/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # Business logic
│   │   ├── models/          # Database schemas
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Auth, validation, etc.
│   │   ├── scripts/         # Utilities and demos
│   │   └── config/          # Configuration
│   ├── docker-compose.yml   # Local development services
│   ├── Dockerfile           # Container configuration
│   └── openapi.yaml         # API documentation
├── frontend/                # React application
│   ├── app/                 # Next.js app router
│   ├── components/          # React components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities and API client
│   └── types/               # TypeScript definitions
└── .kiro/                   # Kiro specs and configuration
    └── specs/subchat-mvp/   # Feature specifications
```

## 🔧 Configuration

### Backend Environment Variables

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/subchat-mvp
ELASTIC_URL=http://localhost:9200

# Authentication
JWT_SECRET=your-jwt-secret-here
ALLOW_GUEST=true

# AI Services
GEMINI_API_KEY=your-gemini-key-here

# Server
PORT=3001
NODE_ENV=development
```

### Frontend Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🎯 Key User Flows

### 1. Basic Chat Flow

1. **Start New Chat**: Choose "Use Past Knowledge" or "Start Fresh"
2. **Send Message**: Type and send your message
3. **Receive Response**: Get streaming AI response
4. **Continue Conversation**: Build on the discussion

### 2. Sub-Chat Flow

1. **Create Sub-Chat**: Hover over message → "Create sub-task"
2. **Focus Discussion**: Work on specific sub-topic
3. **Merge Results**: Click "Merge & Continue" when done
4. **Memory Storage**: Optionally save insights to memory

### 3. Memory Management

1. **Enable Memory**: Toggle in user settings
2. **Automatic Learning**: System learns from merged sub-chats
3. **Smart Retrieval**: New chats use relevant past knowledge
4. **Manual Control**: Toggle individual memories on/off

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run specific test suites
npm run test:watch

# Test individual components
npm run test:mongo
npm run test:elastic
npm run test:auth
npm run test:subchats
npm run test:admin
```

### Integration Tests

```bash
# Test complete user flows
npm run demo:flows

# Test specific flows
npm run demo:flows -- --flow=auth
npm run demo:flows -- --flow=subchat
npm run demo:flows -- --flow=memory
```

### Frontend Tests

```bash
cd frontend
npm test
```

## 🚢 Deployment

### Local Development

```bash
# Using Docker Compose
cd backend
docker-compose up -d
npm run dev

# Manual setup
# 1. Start MongoDB and Elastic Search
# 2. Configure environment variables
# 3. Run: npm run dev
```

### Production (Google Cloud Run)

```bash
# Build and deploy
cd backend
./scripts/deploy-cloudrun.sh

# Or using gcloud directly
gcloud run deploy subchat-mvp \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

See [DEPLOYMENT.md](backend/DEPLOYMENT.md) for detailed deployment instructions.

## 📚 API Documentation

### Interactive Documentation

- **Swagger UI**: `http://localhost:3001/api-docs` (when server is running)
- **OpenAPI Spec**: [backend/openapi.yaml](backend/openapi.yaml)
- **Postman Collection**: [backend/postman_collection.json](backend/postman_collection.json)

### Key Endpoints

```bash
# Authentication
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/profile

# Conversations
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/:id
POST   /api/conversations/:id/messages
POST   /api/conversations/start

# Sub-Chats
POST   /api/subchats
GET    /api/subchats/:id
POST   /api/subchats/:id/messages
GET    /api/subchats/:id/stream
POST   /api/subchats/:id/merge

# Memory
GET    /api/memory/list
POST   /api/memory/retrieve
DELETE /api/memory/:id

# Admin
GET    /api/admin/usage
POST   /api/admin/memory/cleanup
```

## 🎨 Chrome Built-in AI Integration

The application automatically detects and uses Chrome's built-in AI APIs when available:

```javascript
// Automatic detection
const hasAI = await window.ai?.canCreateTextSession();

// Client-side processing
if (hasAI) {
  const session = await window.ai.createTextSession();
  const result = await session.prompt("Summarize this text...");
} else {
  // Fallback to server API
  const result = await fetch('/api/llm/summarize', { ... });
}
```

## 🧠 Memory System

### How It Works

1. **Sub-Chat Resolution**: When sub-chats are merged, summaries are generated
2. **Memory Storage**: Summaries stored in Elastic Search with vector embeddings
3. **Smart Retrieval**: New conversations retrieve relevant past knowledge
4. **User Control**: Users can opt-in/out and toggle individual memories

### Memory Structure

```typescript
interface Memory {
  title: string;
  content: string;
  keywords: string[];
  embedding: number[];  // Vector for semantic search
  conversationId: string;
  subchatId: string;
  createdAt: Date;
}
```

## 🔍 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   ```bash
   # Check if MongoDB is running
   docker ps | grep mongo
   # Or start with Docker
   docker-compose up -d mongodb
   ```

2. **Elastic Search Not Available**
   ```bash
   # Memory features will fallback to text search
   # Start Elastic Search:
   docker-compose up -d elasticsearch
   ```

3. **Gemini API Errors**
   ```bash
   # Check your API key in .env
   # Verify account has credits
   # Check rate limits
   ```

4. **Chrome AI Not Working**
   ```bash
   # Ensure Chrome version 127+
   # Enable chrome://flags/#optimization-guide-on-device-model
   # Fallback to server API is automatic
   ```

### Debug Mode

```bash
# Backend debug logging
DEBUG=subchat:* npm run dev

# Frontend debug mode
NEXT_PUBLIC_DEBUG=true npm run dev
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes and test**: `npm test`
4. **Commit changes**: `git commit -m 'Add amazing feature'`
5. **Push to branch**: `git push origin feature/amazing-feature`
6. **Open Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Use conventional commit messages
- Ensure all tests pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google** for Gemini API
- **Chrome Team** for built-in AI APIs
- **Elastic** for search capabilities
- **MongoDB** for database services
- **Vercel** for Next.js framework

## 📞 Support

- **Documentation**: Check the `/docs` folder
- **Issues**: Open a GitHub issue
- **Discussions**: Use GitHub Discussions
- **Email**: [Add your contact email]

---

**Built with ❤️ for the future of conversational AI**