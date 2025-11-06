# Changelog

All notable changes to ADO Explorer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-01-05

### 🎉 Major Improvements - Conversation Management & Collection Persistence

This release focuses on conversation history management, fixing collection list items, and quality-of-life improvements.

#### ✨ Key Features

**Conversation Management**
- **Delete All Conversations** - Beautiful red trash button next to "New Conversation" in sidebar
  - Opens confirmation modal showing count and list of conversations to delete
  - Shows first 5 conversations with "... and X more" indicator
  - Loading spinner during deletion
  - Auto-creates fresh conversation after deletion

- **15 Conversation History Limit** - Automatic conversation cleanup
  - System maintains maximum of 15 conversations
  - When creating 16th conversation, automatically deletes oldest
  - Sorted by `updatedAt` timestamp (least recently updated = oldest)
  - Completely automatic and transparent to users
  - Keeps Redis clean and performant

- **Welcome Message Persistence** - Welcome message now saved to conversation history
  - Persists when switching conversations
  - Clear starting point for each conversation
  - Includes all tips, examples, and links

**Collection Items Fixed (CRITICAL)**
- **ListItems Rendering Bug** - Fixed collections not displaying when reloading conversations
  - Root cause: Empty `workItems` array was truthy, triggering wrong rendering path
  - Fix: Check `workItems.length > 0` instead of just checking array existence
  - Collections now persist correctly: sprints, users, projects, teams, states, types, tags, iterations
  - Clickable buttons restore properly when switching conversations

**Enhanced Logging**
- **Comprehensive Debug Logging** - Added detailed logging throughout data flow
  - Save-message route logs metadata structure and listItems verification
  - Conversation route logs retrieved messages with metadata samples
  - Frontend logs restoration process and final UI state
  - Helps diagnose any future persistence issues

#### 🔧 Technical Implementation

**Files Modified:**
- `components/ConversationSidebar.tsx`
  - Added `showDeleteAllConfirm` and `isDeletingAll` state
  - Added Delete All button in header with red styling
  - Added Delete All confirmation modal with conversation preview
  - `handleDeleteAll()` uses `Promise.all()` for parallel deletion

- `components/ChatInterface.tsx`
  - `handleNewConversation()` checks conversation count before creating
  - Auto-deletes oldest conversation if count >= 15
  - Saves welcome message to conversation via `saveMessageToConversation()`

- `components/MessageList.tsx`
  - Fixed line 330 condition to check `workItems.length > 0`
  - Prevents empty array from triggering work items rendering

- `app/api/conversations/[id]/save-message/route.ts`
  - Enhanced logging with metadata verification
  - Logs listItems structure (isArray, firstItem, value, commandName)

- `app/api/conversations/[id]/route.ts`
  - Enhanced logging when retrieving messages
  - Logs messages with listItems including samples

- `package.json`
  - Version bumped from 0.2.0 to 0.3.0

#### 🎯 Impact

- **Better Conversation Management** - Delete all conversations with one click, automatic history limit
- **Fixed Critical Bug** - Collections now persist correctly when switching conversations
- **Cleaner User Experience** - Welcome messages save so users always see their starting point
- **Better Debugging** - Comprehensive logging helps diagnose issues quickly
- **Performance** - 15 conversation limit keeps Redis fast and clean

#### 💡 Usage Examples

**Delete All Conversations:**
1. Click red trash icon in sidebar header
2. Modal shows: "You are about to delete 15 conversations"
3. Click "Delete All (15)" → All deleted + new conversation created
4. Fresh start with welcome message

**15 Conversation Limit:**
- Happens automatically when you create conversations
- Never see more than 15 in your sidebar
- Oldest conversations auto-deleted to make room

**Collection Persistence:**
1. Ask "list all sprints" → See clickable sprint buttons
2. Switch to another conversation
3. Switch back → Sprint buttons still there! ✨

---

## [0.2.0] - 2025-01-05

### 🎉 MAJOR FEATURE - Conversational AI with Memory

The biggest update yet! ADO Explorer now has **full conversational AI capabilities** with persistent conversation history, context retention, and ChatGPT/Claude.ai-style interface.

#### ✨ Key Features

- **Persistent Conversations** - All conversations stored in Redis with 30-day retention
- **Context-Aware Responses** - AI remembers your previous messages and maintains context throughout the conversation
- **Conversation Sidebar** - ChatGPT/Claude.ai-style sidebar showing all your conversations
  - Grouped by time: Today, Yesterday, Last 7 Days, Last 30 Days, Older
  - Shows message preview and count for each conversation
  - One-click to continue previous conversations
  - Delete unwanted conversations
  - Collapsible sidebar for more screen space

- **Two Modes** - Toggle between "Quick Search" and "Conversations"
  - **Quick Search Mode**: Original fast slash-command interface for rapid work item searches
  - **Conversations Mode**: New contextual AI chat with full conversation history

- **Streaming Responses** - Real-time message streaming with typing animation
- **Auto-Title Generation** - Conversations automatically titled after 2-3 messages
- **Smart Context Window Management** - Sliding window approach keeps conversations within Claude's 200K token limit
  - Maintains minimum 10-15 recent messages
  - Uses 80% of token budget efficiently
  - Oldest messages automatically pruned when needed

<details>
<summary><strong>Click to see full 0.2.0 details</strong></summary>

#### 🔧 Technical Implementation

**New API Endpoints:**
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations` - List user's conversations
- `GET /api/conversations/[id]` - Get conversation with full message history
- `PATCH /api/conversations/[id]` - Update conversation metadata (title, etc.)
- `DELETE /api/conversations/[id]` - Delete conversation and all messages
- `POST /api/conversations/[id]/messages` - Send message with Server-Sent Events streaming

**Redis Data Architecture:**
- **Conversation metadata**: Redis Hash (`conversation:{id}`)
- **Message storage**: Redis Sorted Set (`conversation:{id}:messages`) sorted by timestamp
- **User index**: Redis Sorted Set (`user:{userId}:conversations`) sorted by last update
- **TTL Management**: 30 days for active conversations, 7 days for inactive
- **Optimistic updates**: Instant UI feedback before server confirmation

**New Components:**
- `ConversationSidebar.tsx` - Conversation list with grouping and management
- `ChatArea.tsx` - Message display with markdown rendering and syntax highlighting
- `MessageInput.tsx` - Auto-resizing textarea with keyboard shortcuts
- `ConversationalChat.tsx` - Main orchestrator component
- `ChatModeWrapper.tsx` - Mode toggle between Quick Search and Conversations

**New Services:**
- `ConversationService` (lib/redis/conversationService.ts) - Complete CRUD operations
  - Create, read, update, delete conversations
  - Add messages with token tracking
  - Retrieve messages with sliding window context
  - List user conversations with pagination
  - Auto-title generation

**Type Definitions:**
- `Message` interface with role, content, timestamp, tokenCount
- `Conversation` interface with full metadata
- `ConversationSummary` for list views
- `SendMessageRequest` and streaming response types

#### 🎨 UI/UX Enhancements

- **Mode Toggle Bar** - Clean interface to switch between Quick Search and Conversations
- **Markdown Rendering** - Full GitHub-Flavored Markdown support in messages
  - Code blocks with syntax highlighting
  - Tables, lists, blockquotes
  - Links, emphasis, headings
  - Inline code with cyan highlighting

- **Message Formatting** - Professional chat interface
  - User messages (blue accent) and Assistant messages (green accent)
  - Avatar icons for visual distinction
  - Timestamp display (relative for recent, absolute for older)
  - Streaming animation with cursor indicator

- **Keyboard Shortcuts**
  - Enter: Send message
  - Shift+Enter: New line in message
  - Escape: Close modals/dropdowns

#### 🔐 Security & Performance

- **Authentication Required** - All conversation endpoints verify JWT tokens
- **User Isolation** - Users can only access their own conversations
- **Connection Pooling** - Redis client singleton with reconnection logic
- **Streaming Efficiency** - Server-Sent Events for real-time responses
- **Error Handling** - Graceful degradation with user-friendly error messages

#### 📦 Dependencies Added

- `@anthropic-ai/sdk@^0.32.0` - Claude API integration
- `uuid@^11.0.3` - Unique ID generation
- `@types/uuid@^10.0.0` - TypeScript definitions

#### 🎯 Impact

- **Enhanced User Experience** - Users can now have ongoing conversations with context
- **Better Insights** - AI can provide more detailed answers by remembering previous context
- **Increased Productivity** - Continue conversations where you left off
- **ChatGPT-like Experience** - Familiar interface for users
- **Backward Compatible** - Original Quick Search mode still available and unchanged

#### 💡 Usage Examples

**Starting a Conversation:**
1. Click "Conversations" mode toggle at top
2. Click "Start New Conversation" or the + button
3. Ask questions naturally - AI remembers your context
4. Continue the conversation anytime by selecting it from sidebar

**Context Retention:**
```
You: "What bugs are assigned to me?"
AI: "You have 5 bugs assigned... [shows list]"
You: "What about the P1 ones?"  // AI remembers "bugs assigned to me"
AI: "Of those 5 bugs, 2 are P1... [shows filtered list]"
```

**Conversation Management:**
- Hover over conversation → Delete button appears
- Click conversation to continue where you left off
- Sidebar shows last message preview
- Auto-generated titles make conversations easy to find

</details>

---

<details>
<summary><strong>Previous Releases</strong> (v0.1.0 - v0.1.9) - click to expand</summary>

## [0.1.9] - 2025-01-05

### 🎨 Enhanced - AI Output Formatting
- **Improved readability for AI-generated content** - Test cases, release notes, and other AI outputs are now much easier to read
  - Increased padding from 12px to 24px for more breathing room
  - Larger text size (prose-base instead of prose-sm)
  - Increased max height from 320px to 600px for more visible content
  - Enhanced line spacing with `leading-relaxed` throughout

### 📝 Typography Improvements
- **Better heading hierarchy** - Clear visual distinction between heading levels
- **Enhanced lists** - Lists are now properly spaced and indented
- **Better inline elements** - Improved code, links, and blockquotes
- **Code blocks** - Improved presentation
- **Tables** - Professional formatting

---

## [0.1.8] - 2025-01-05

### ✨ Added - Hierarchical Display in Grid View
- **Hierarchical grid/table view** - Grid view now shows parent/child relationships just like card view
- **Visual Enhancements** - Indentation, relation badges, color coding, collapsible rows

---

## [0.1.7] - 2025-01-05

### 🎨 Enhanced - Button Consistency
- **Normalized all CTA buttons** - CSV, JSON, Email Me, Chart, and View All buttons now have consistent styling

### 📧 Added - Comprehensive Email Features
- **Email button in ResultsModal** - View All modal now includes email functionality
- **Email button in WorkItemDetailModal** - New "Email Me This Ticket" button

---

## [0.1.6] - 2025-01-05

### ✨ Added
- **Automatic relationship detection in search results** - Work items now automatically show parent/child relationships

---

## [0.1.5] - 2025-01-05

### 🎨 Enhanced
- **Filter slidout tab visibility** - Made the filter button much more prominent with orange gradient and pulse animation

---

## [0.1.4] - 2025-01-05

### ✨ Added
- **Hierarchical work item display** - Related items now display in a collapsible tree structure

---

## [0.1.3] - 2025-01-05

### 📝 Updated
- **Documentation improvements** - Organized changelog with collapsible sections

---

## [0.1.2] - 2025-01-05

### 🔧 Fixed
- **CRITICAL: Multi-team sprint fetching** - Now fetches sprints from ALL teams

---

## [0.1.1] - 2025-01-05

### 🔧 Fixed
- **CRITICAL: Sprint query handling** - Fixed 400 errors when querying sprint items

---

## [0.1.0] - 2024-XX-XX

### Initial Release
- Natural language query interface for Azure DevOps
- Slash commands for direct filtering
- AI-powered conversational answers
- Sprint velocity and analytics
- Chart visualization
- Global filters
- Authentication with email OTP
- Related items discovery
- AI actions (release notes, test cases, summaries)

</details>
