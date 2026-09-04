# MasteryOS: Agentic Learning Operating System

## Vision Statement

MasteryOS transforms passive video consumption into active, mastery-driven learning experiences. We're building an intelligent layer over YouTube's vast educational ecosystem that converts unstructured playlists into personalized, adaptive learning pathways powered by multi-agent AI orchestration.

## The Problem We're Solving

### The Passive Learning Trap

Millions of learners worldwide rely on YouTube as their primary educational resource. While the platform hosts exceptional educational content, its architecture is fundamentally optimized for entertainment and watch time rather than pedagogical effectiveness. This creates several critical problems:

**1. The Illusion of Competence**

Students watch hours of educational videos and feel they've learned, but without active recall or application, the information never transfers to long-term memory. Passive consumption creates a false sense of understanding that evaporates when tested.

**2. Educational Attention Hijacking**

YouTube's recommendation algorithm continuously serves distracting content, depleting the cognitive bandwidth needed for processing complex academic material. Learners intending to study calculus find themselves watching unrelated viral content minutes later.

**3. Lack of Structure and Progression**

Educational playlists often lack proper sequencing. Prerequisites aren't clearly identified, and learners jump into advanced topics without foundational knowledge, leading to confusion and abandonment.

**4. No Feedback or Mastery Validation**

Traditional video platforms provide no mechanism to verify understanding. Learners can complete entire courses without ever demonstrating comprehension or applying concepts.

**5. Break Recovery Challenges**

When learners return after days or weeks away, they're dropped back into complex material with no cognitive priming or context reinstatement, causing frustration and high dropout rates.

## Our Solution

MasteryOS is an **Agentic Learning Operating System** that sits as an intelligent layer over YouTube's content ecosystem. We don't create new videos; instead, we transform how learners interact with existing educational content through:

### Core Capabilities

**1. Intelligent Content Ingestion**

- Automatically extracts transcripts from YouTube playlists
- Analyzes content using AI to identify key concepts and definitions
- Builds a knowledge graph mapping prerequisite relationships between concepts
- Creates semantic embeddings for instant retrieval and context-aware tutoring

**2. Multi-Agent AI Orchestration**

Our system employs specialized AI agents that work together through a stateful orchestration layer:

- **Observer Agent**: Monitors real-time clickstream data (pauses, rewinds, speed changes) to calculate probabilistic confusion scores
- **Socratic Tutor Agent**: Deploys targeted interventions with questions, hints, and analogies when confusion is detected
- **Mastery Evaluator Agent**: Assesses user responses and updates skill mastery scores
- **Path Planner Agent**: Dynamically reorders content based on performance and knowledge gaps
- **Orchestrator Agent**: Coordinates all agents through conditional routing and cyclic workflows

**3. Cognitive Friction Detection**

We analyze behavioral patterns to distinguish between:
- **Cognitive impasse** (genuine confusion requiring intervention)
- **Environmental distraction** (external interruptions)

This prevents false positives and ensures interventions are pedagogically justified, not annoying.

**4. Break Recovery Protocol**

When learners return after extended breaks, we:
- Generate AI-powered recaps of previously mastered concepts
- Provide context reinstatement to reconstruct mental frameworks
- Deploy low-stakes warm-up questions to activate prior knowledge
- Prime working memory before resuming new material

**5. Mastery-Based Progress Tracking**

Instead of measuring "videos watched," we track:
- Concept-level mastery scores
- Interactive knowledge graph visualization
- Achievement system tied to demonstrated understanding
- Real-time confusion metrics and intervention history

**6. Distraction-Free Learning Environment**

- Videos are isolated from YouTube's recommendation algorithm
- Clean, focused interface optimized for deep work
- Theater mode for immersive learning sessions
- Integrated note-taking tied to specific videos

## Technical Architecture

### Technology Stack

**Frontend**
- React 19 with Vite for fast development
- Framer Motion for smooth animations
- vis-network for interactive knowledge graph visualization
- react-player for video playback with event tracking
- Zustand for state management

**Backend (Node.js)**
- Express.js API server
- YouTube Data API integration with fallback scraping
- Groq API for fast LLM inference (llama-3.3-70b-versatile)
- @xenova/transformers for local embeddings (all-MiniLM-L6-v2)
- MongoDB Atlas for session persistence and user data
- Qdrant Cloud for vector storage and semantic search
- Neo4j AuraDB for knowledge graph storage

**Agent Core (Python)**
- FastAPI for agent service endpoints
- LangGraph for multi-agent state machine orchestration
- Stateful checkpointing for resumable learning sessions
- Groq SDK for agent reasoning and tool use

### System Flow

1. **Ingestion Pipeline** (Background Processing)
   - User submits YouTube playlist URL
   - System immediately returns video list (user can start watching)
   - Background: Extract transcripts → Chunk with timestamps → AI summarization
   - Extract concepts and prerequisites → Build knowledge graph
   - Generate embeddings → Store in vector database

2. **Learning Session** (Real-Time)
   - User watches video in distraction-free player
   - Clickstream events (play, pause, seek, speed) stream to backend
   - Observer agent analyzes patterns every 15 seconds
   - When confusion threshold reached: pause video, deploy Socratic intervention
   - User answers question → Evaluator scores → Update mastery graph
   - Resume video or provide additional hints based on performance

3. **Break Recovery** (Session Resumption)
   - Detect time gap since last session
   - Query knowledge graph for previously mastered concepts
   - Generate AI recap summary
   - Present warm-up questions before resuming
   - Smooth cognitive transition back into learning

## Current Implementation Status

### ✅ Fully Implemented Features

- YouTube playlist import with metadata extraction
- Transcript extraction (official API + yt-dlp fallback)
- Timestamp-aware transcript chunking
- AI-powered chunk summarization using Groq
- Concept extraction and knowledge graph construction
- Vector embeddings and semantic storage in Qdrant
- Neo4j knowledge graph with prerequisite relationships
- Interactive video player with clickstream tracking
- Real-time confusion score calculation
- Socratic intervention modal with quiz system
- Multi-agent orchestration using LangGraph
- Session persistence with MongoDB
- Knowledge graph visualization with vis-network
- Dashboard with mastery tracking
- Achievement system with badges
- Note-taking system per video
- Theater mode for focused learning
- Authentication and user profiles
- Onboarding flow
- Keyboard shortcuts
- Dark theme UI with glassmorphism design

### 🚧 In Progress / Planned Enhancements

- **Enhanced Break Recovery**: Currently shows placeholder UI; full AI-powered recap generation is implemented in backend but needs frontend integration
- **Advanced Path Planning**: Knowledge graph is built but dynamic content reordering based on mastery scores needs refinement
- **Playlist-Level Summaries**: Chunk summaries work well; playlist-level overview generation is planned
- **Mastery Score Persistence**: Local tracking works; backend persistence and cross-session continuity needs completion
- **AI Chat Tutor**: UI exists but needs connection to agent service for conversational tutoring
- **Search Functionality**: Page exists but semantic search over knowledge graph needs implementation
- **Multi-Playlist Support**: Infrastructure ready; UI for managing multiple learning paths needs enhancement
- **Spaced Repetition**: Framework in place; scheduling algorithm needs implementation
- **Collaborative Learning**: Architecture supports it; social features are future roadmap

## Key Differentiators

### What Makes MasteryOS Unique

**1. True Multi-Agent Intelligence**

Unlike simple chatbots, we use LangGraph's stateful orchestration to create cyclic, deliberative workflows. Agents can loop, retry, and adapt based on learner responses.

**2. Behavioral Psychology Integration**

We apply cognitive science principles:
- Cognitive load management through break recovery
- Context-dependent memory through priming
- Active recall through Socratic interventions
- Spaced repetition (planned)

**3. Probabilistic Intervention Logic**

We don't use rigid rules ("3 rewinds = quiz"). Instead, we calculate weighted confusion scores from multiple behavioral signals to make nuanced decisions.

**4. Knowledge Graph Foundation**

Every concept is mapped with prerequisites, enabling intelligent content sequencing and gap identification that simple linear playlists can't provide.

**5. Free-Tier Architecture**

Built entirely on free tiers (Groq, Qdrant, Neo4j Aura, MongoDB Atlas) to remain accessible to students worldwide.

## Educational Philosophy

### Mastery-Based Learning

We reject the "content completion" model. Progress is measured by demonstrated understanding, not time spent watching videos.

### Active Learning Over Passive Consumption

We force cognitive engagement through:
- Retrieval practice (quizzes at confusion points)
- Elaboration (explaining concepts in own words)
- Application (problem-solving interventions)

### Learner Autonomy

Interventions can always be skipped or snoozed. We guide, not dictate. The system adapts to individual learning styles and pacing.

### Error-Tolerant Design

Returning after breaks is welcomed, not penalized. We provide scaffolding to ease back into learning rather than creating shame or friction.

## Use Cases

### Primary Audience

**Self-Directed Learners**
- Students supplementing formal education
- Career changers learning new skills
- Lifelong learners exploring complex topics
- Anyone using YouTube for serious study

### Ideal Content Types

- Lecture series (MIT OpenCourseWare, Stanford, etc.)
- Tutorial sequences (3Blue1Brown, Khan Academy)
- Technical courses (programming, mathematics, science)
- Structured educational playlists with sequential dependencies

### Example Scenarios

**Scenario 1: Computer Science Student**
- Imports MIT 6.006 Algorithms playlist
- System builds prerequisite graph (sorting → trees → graphs → dynamic programming)
- Watches lecture on quicksort
- Rewinds partition logic multiple times
- System detects confusion, pauses video
- Presents: "Can you explain why the pivot choice affects performance?"
- Student answers, receives targeted hint
- Mastery score updated, continues learning

**Scenario 2: Career Changer Learning ML**
- Imports 3Blue1Brown Neural Networks series
- Completes first two videos on neurons and gradient descent
- Takes 2-week break
- Returns: System shows recap of backpropagation basics
- Warm-up question: "What does the chain rule help us calculate?"
- Primed and ready, continues to next video on convolutional networks

## Technical Highlights

### Ingestion Pipeline Optimization

**Two-Phase Processing**
- Phase 1 (Fast): Return video list immediately so users can start watching
- Phase 2 (Background): Process transcripts, build knowledge graph, generate embeddings

This creates a responsive UX while handling expensive AI operations asynchronously.

### Clickstream Heuristics

We track and weight multiple signals:
- **Rewind density**: Multiple short seeks to same segment (high confusion indicator)
- **Pause patterns**: Frequent short pauses (active processing) vs. single long pause (distraction)
- **Speed modulation**: Slowing down indicates difficulty
- **Click frequency**: High activity suggests engagement

### Timestamp-Aware Chunking

When available, we use yt-dlp's timestamped transcript segments to create chunks that align with natural speech boundaries, preserving context and enabling precise video navigation.

### Embedding Strategy

We use all-MiniLM-L6-v2 (384-dim) for:
- Fast local inference (~68ms query time)
- Low resource footprint (1.2GB RAM)
- Sufficient accuracy for educational content (78.1% top-5 retrieval)

### LangGraph State Machine

Our agent graph supports:
- Conditional routing based on confusion scores
- Cyclic workflows (tutor → evaluator → tutor until mastery)
- Persistent checkpoints for resumable sessions
- Shared state across all agents

## Data Privacy & Ethics

### Privacy-First Design

- All processing happens on our servers or in browser
- No data sold to third parties
- User learning data stored securely in MongoDB
- Optional anonymous usage analytics for improvement

### Ethical AI Use

- Transparent about AI limitations
- Always allow users to skip interventions
- No manipulative dark patterns
- Focus on genuine learning outcomes, not engagement metrics

### Content Respect

- We don't modify or redistribute YouTube content
- Transcripts used only for analysis and tutoring
- All video playback happens through official YouTube embeds
- Respect creator intent and platform terms

## Deployment & Scalability

### Current Deployment

- Frontend: Vercel (free tier)
- Backend Node.js: Render (free tier)
- Agent Core Python: Render (free tier)
- Databases: Cloud free tiers (MongoDB Atlas, Qdrant Cloud, Neo4j Aura)

### Scalability Considerations

**Current Limitations**
- Free tier rate limits on Groq API (~14,400 requests/day)
- Render free instances sleep after inactivity
- MongoDB Atlas 512MB storage limit
- Qdrant 1GB vector storage

**Future Scaling Path**
- Implement caching for popular playlists (shared knowledge graphs)
- Lazy embedding strategy (embed on-demand, cache results)
- Upgrade to paid tiers as user base grows
- Consider self-hosted infrastructure for cost optimization

## Development Roadmap

### Phase 1: Core Experience (Current)
- ✅ Playlist ingestion and knowledge graph
- ✅ Video player with clickstream tracking
- ✅ Socratic interventions
- ✅ Basic mastery tracking
- 🚧 Break recovery integration

### Phase 2: Intelligence Enhancement (Next 3 Months)
- Advanced path planning with dynamic reordering
- Spaced repetition scheduling
- Conversational AI tutor
- Semantic search across knowledge base
- Enhanced mastery algorithms

### Phase 3: Social & Collaborative (6 Months)
- Study groups and shared playlists
- Peer learning features
- Instructor dashboard for course creators
- Community knowledge contributions

### Phase 4: Platform Expansion (12 Months)
- Support for other video platforms (Coursera, Udemy, etc.)
- Mobile applications (iOS, Android)
- Browser extension for in-place YouTube enhancement
- API for third-party integrations

## Getting Started (For Developers)

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB Atlas account (free)
- Neo4j Aura account (free)
- Qdrant Cloud account (free)
- Groq API key (free)
- YouTube Data API key (optional, free)

### Environment Setup

**Backend Node.js** (`.env`)
```
PORT=5000
FRONTEND_URL=http://localhost:5173
GROQ_API_KEY=your_groq_key
MONGODB_URI=your_mongodb_connection_string
NEO4J_URI=your_neo4j_uri
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_key
YOUTUBE_API_KEY1=your_youtube_key (optional)
```

**Agent Core Python** (`.env`)
```
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
MONGODB_URI=your_mongodb_connection_string
NEO4J_URI=your_neo4j_uri
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_key
```

**Frontend** (`.env`)
```
VITE_API_URL=http://localhost:5000/api
```

### Installation & Running

**Frontend**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

**Backend Node.js**
```bash
cd backend-node
npm install
npm start
# Runs on http://localhost:5000
```

**Agent Core Python**
```bash
cd agent-core-py
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Runs on http://localhost:8000
```

## Project Structure

```
learning-os/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   ├── api.js           # Backend API client
│   │   └── store.js         # Zustand state management
│   └── package.json
│
├── backend-node/            # Express API server
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   │   ├── ingestion.js    # Playlist processing
│   │   │   ├── clickstream.js  # Event tracking
│   │   │   ├── session.js      # User sessions
│   │   │   ├── agent.js        # Agent proxy
│   │   │   └── graph.js        # Knowledge graph queries
│   │   └── utils/           # Helper modules
│   │       ├── youtube.js      # YouTube integration
│   │       ├── groqClient.js   # LLM calls
│   │       ├── embeddings.js   # Vector generation
│   │       ├── qdrantClient.js # Vector DB
│   │       ├── neo4jClient.js  # Graph DB
│   │       └── mongoClient.js  # Document DB
│   └── package.json
│
└── agent-core-py/           # Python agent service
    ├── app/
    │   ├── main.py          # FastAPI application
    │   ├── graph/           # LangGraph orchestration
    │   │   ├── state.py        # State schema
    │   │   ├── nodes.py        # Agent implementations
    │   │   ├── edges.py        # Routing logic
    │   │   └── graph.py        # Graph compilation
    │   └── prompts/         # LLM prompt templates
    └── requirements.txt
```

## Contributing

We welcome contributions! Areas where help is especially valuable:

- **Prompt Engineering**: Improving AI summarization and concept extraction
- **Educational Psychology**: Enhancing intervention strategies
- **UI/UX Design**: Making the learning experience more intuitive
- **Testing**: Property-based testing for agent behaviors
- **Documentation**: Tutorials, guides, and examples
- **Performance**: Optimizing ingestion pipeline and vector search

## Acknowledgments

### Inspiration

This project draws on research and ideas from:
- Educational data mining and learning analytics
- Cognitive load theory and multimedia learning principles
- Spaced repetition and active recall research
- Multi-agent systems and LangGraph framework
- The broader EdTech community working to improve online learning

### Technologies

Built with open-source tools and free-tier services:
- React, Vite, Framer Motion
- Express.js, FastAPI
- LangGraph, LangChain
- Groq (fast LLM inference)
- MongoDB Atlas, Neo4j Aura, Qdrant Cloud
- vis-network, react-player
- And many more amazing open-source libraries

## License

This project is currently in active development. License information will be added soon.

## Contact & Community

- **Project Status**: Active Development (Prototype Phase)
- **Target Launch**: Q2 2026 (Beta)
- **Looking For**: Early adopters, contributors, feedback

---

**MasteryOS** - Transforming passive video consumption into active, mastery-driven learning.

*Built with ❤️ for learners everywhere who deserve better than algorithmic distraction.*
