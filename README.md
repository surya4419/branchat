# BranChat - Intelligent Conversational AI Platform

BranChat is a powerful full-stack chat application featuring nested sub-conversations (SubChats), intelligent context management, and seamless AI integration. Built with React and Node.js, BranChat offers a unique approach to managing complex conversations through branching discussions and smart memory features.

## 🌟 Key Features

### 💬 Core Chat Features
- **Intelligent Conversations**: Engage in natural, context-aware conversations with AI
- **Real-time Responses**: Streaming AI responses for immediate feedback
- **Conversation Management**: Create, rename, delete, and organize multiple conversations
- **Dark Mode Support**: Beautiful UI with light and dark theme options
- **Guest Mode**: Try the application without creating an account

### 🌳 SubChat System
- **Branching Conversations**: Create focused sub-discussions from any message
- **Context Preservation**: SubChats maintain full context from parent conversations
- **Text Selection**: Highlight specific text to create targeted SubChats
- **Merge & Summarize**: Consolidate SubChat insights back into main conversations
- **Read-Only Mode**: Review merged SubChats without editing
- **Visual Indicators**: Clear UI showing active SubChats and merged summaries

### 🧠 Smart Memory & Context
- **Previous Knowledge Toggle**: Choose whether new conversations use past knowledge
- **SubChat Context**: Automatically includes relevant SubChat discussions in responses
- **Cross-Conversation Memory**: Access insights from previous conversations (when enabled)
- **Context Indicators**: Visual badges showing active context and memory usage
- **30-Day History**: Automatic cleanup of old SubChat histories

### 🎨 User Experience
- **Modern UI**: Clean, ChatGPT-inspired interface with smooth animations
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Keyboard Shortcuts**: Quick navigation and actions
- **Search Functionality**: Find conversations quickly with built-in search
- **Message Actions**: Copy, create SubChats, and ask follow-ups with ease
- **Markdown Support**: Rich text formatting in messages

### 🔐 Authentication & Security
- **User Accounts**: Secure registration and login system
- **Guest Sessions**: Unique guest IDs for demo functionality
- **JWT Authentication**: Secure token-based authentication
- **User Settings**: Profile management and preferences
- **Account Security**: Password management and account deletion options

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BranChat                              │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Frontend      │    Backend      │   External Services     │
│   (React +      │  (Node.js +     │                         │
│   TypeScript)   │   Express)      │                         │
├─────────────────┼─────────────────┼─────────────────────────┤
│ • Chat UI       │ • REST API      │ • MongoDB Atlas         │
│ • SubChat Pane  │ • Authentication│ • Gemini API            │
│ • Context Mgmt  │ • Conversations │ • Elastic Search (opt)  │
│ • Memory Banner │ • Messages      │                         │
│ • User Settings │ • SubChats      │                         │
│ • Theme System  │ • Memory System │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** 18+ and npm
- **MongoDB** (local installation or MongoDB Atlas account)
- **Gemini API Key** (from Google AI Studio)
- **Elastic Search** (optional, for advanced memory features)

### Installation

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd branchat
```

#### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `backend/.env` with your configuration:

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/branchat
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/branchat

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this
ALLOW_GUEST=true

# AI Service
GEMINI_API_KEY=your-gemini-api-key-here

# Server Configuration
PORT=3001
NODE_ENV=development

# Optional: Elastic Search for Advanced Memory
ELASTIC_URL=http://localhost:9200
ELASTIC_INDEX=branchat-memories
```

#### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Create environment file (if needed)
cp .env.example .env
```

Edit `frontend/.env`:

```bash
VITE_API_URL=http://localhost:3001
```

#### 4. Start the Application

```bash
# Ensure MongoDB is running locally
# mongod --dbpath /path/to/data

# Start backend
cd backend
npm run dev

# In a new terminal, start frontend
cd frontend
npm run dev
```

#### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

### First Time Setup

1. Open http://localhost:5173 in your browser
2. The app will automatically create a guest session
3. Start chatting immediately or sign up for a full account
4. Try creating a SubChat by clicking the branch icon on any message

## 🎯 How to Use BranChat

### Basic Chat Flow

1. **Start a New Conversation**
   - Click "New chat" in the sidebar
   - Choose whether to use previous knowledge
   - Start typing your message

2. **Send Messages**
   - Type your message in the composer
   - Press Enter or click Send
   - Watch the AI response stream in real-time

3. **Manage Conversations**
   - Rename: Click the three dots → Rename
   - Delete: Click the three dots → Delete
   - Search: Use the search bar to find conversations

### Using SubChats

SubChats are BranChat's unique feature for focused discussions:

1. **Create a SubChat**
   - Hover over any AI message
   - Click the branch icon
   - Or select specific text and click "Create sub chat"

2. **Work in SubChat**
   - Ask focused questions about the selected topic
   - The SubChat maintains full context from the parent conversation
   - Continue the discussion as long as needed

3. **Merge SubChat**
   - Click "Merge & Continue" when done
   - BranChat generates a summary of the SubChat
   - The summary is saved globally for future conversations
   - Return to the main conversation with enhanced context

4. **View Merged SubChats**
   - Merged SubChats appear as cards under their parent message
   - Click a card to reopen in read-only mode
   - Click "Continue Chat" to resume the discussion

### Memory & Context Features

1. **Previous Knowledge Toggle**
   - When starting a new chat, choose "Use Previous Knowledge"
   - BranChat will include insights from past conversations
   - Visual indicator shows when previous knowledge is active

2. **SubChat Context**
   - Merged SubChats are automatically included in future responses
   - Context is stored for 30 days
   - Works across all conversations (when previous knowledge is enabled)

3. **Context Indicators**
   - Blue badge: SubChat context active
   - Purple badge: Previous knowledge active
   - Hover to see details

## 🔧 Configuration

### Backend Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | Secret key for JWT tokens | Yes | - |
| `GEMINI_API_KEY` | Google Gemini API key | Yes | - |
| `PORT` | Server port | No | 3001 |
| `NODE_ENV` | Environment (development/production) | No | development |
| `ALLOW_GUEST` | Enable guest mode | No | true |
| `ELASTIC_URL` | Elastic Search URL (optional) | No | - |

### Frontend Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_URL` | Backend API URL | No | http://localhost:3001 |

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- conversations.test.ts
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Manual Testing

```bash
# Test API endpoints
cd backend
npm run demo:flows

# Test specific features
curl http://localhost:3001/api/health
```

## 🚢 Deployment

### Production Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## � TProubleshooting

### Common Issues

**1. MongoDB Connection Error**
```bash
# Check if MongoDB is running
mongosh

# Start MongoDB if not running
mongod --dbpath /path/to/data
```

**2. Gemini API Errors**
- Verify your API key in `.env`
- Check API quota at https://makersuite.google.com/
- Ensure billing is enabled for your Google Cloud project

**3. Port Already in Use**
```bash
# Kill process on port 3001 (backend)
# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:3001 | xargs kill -9
```

**4. Frontend Can't Connect to Backend**
- Verify backend is running on port 3001
- Check `VITE_API_URL` in frontend `.env`
- Ensure CORS is properly configured

**5. SubChats Not Saving**
- Check browser console for errors
- Verify localStorage is enabled
- Clear browser cache and try again

### Debug Mode

```bash
# Backend with debug logs
DEBUG=branchat:* npm run dev

# Frontend with verbose logging
VITE_DEBUG=true npm run dev
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m 'Add amazing feature'`
5. Push to your branch: `git push origin feature/amazing-feature`
6. Open a Pull Request


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.



## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/surya4419/branchat/issues)
- **Discussions**: [GitHub Discussions](https://github.com/surya4419/branchat/discussions)
- **Documentation**: Check the `/docs` folder for detailed guides
- **Email**: suryaa4419@gmail.com



---

**Built with ❤️ by the BranChat Team**

*Making conversations smarter, one branch at a time.*
