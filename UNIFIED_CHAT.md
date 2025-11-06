# Unified Conversational Chat

## Overview

ADO Explorer now has a **single, unified chat experience**! All interactions are conversational, context-aware, and automatically saved to your user database.

## What Changed

### Before (Two Systems)
Previously, ADO Explorer had two separate chat modes:

1. **Quick Search** - Fast, non-persistent searches with slash commands
2. **Conversations** - AI chat with context and saved history

Users had to toggle between modes, which was confusing and fragmented the experience.

### After (One System)
Now there's **only one chat experience**:
- ✅ All interactions are conversations
- ✅ Every conversation is saved automatically
- ✅ Full context and memory across your session
- ✅ AI-powered with Claude
- ✅ Smart follow-up suggestions
- ✅ No mode switching needed

## Features

### 🎯 Persistent Conversations
- **Every chat is saved** to Redis (your user database)
- **Context preserved** across page reloads
- **Conversation history** in sidebar
- **Search through past conversations**

### 🤖 AI-Powered
- **Natural language** queries (no special syntax)
- **Smart detection** of collection queries (projects, teams, users, etc.)
- **Beautiful formatting** with markdown tables
- **Contextual responses** that build on previous messages

### ✨ Follow-Up Suggestions
- **3-4 smart suggestions** after each response
- **One-click exploration** - just click to ask
- **Context-aware** - references actual data from results
- **Conversation-aware** - builds on previous questions

### 💾 Automatic Saving
- **No manual save** - everything saves automatically
- **Conversation titles** auto-generated from first message
- **Message timestamps** for all interactions
- **User-specific** - your conversations are private

### 🎨 Clean UI
- **Sidebar** with conversation list
- **Collapsible** sidebar for more space
- **New conversation** button always available
- **Delete conversations** from sidebar
- **Search conversations** (coming soon)

## How It Works

### Auto-Creation
When you first visit ADO Explorer:
1. System automatically creates a new conversation
2. Welcome message appears with helpful tips
3. You can start asking questions immediately

### Conversation Flow
```
You ask: "list all projects"
   ↓
System detects: collection query (projects)
   ↓
Fetches: Real project data from Azure DevOps
   ↓
Claude formats: Beautiful markdown table
   ↓
Displays: Projects with context and insights
   ↓
Suggests: Follow-up questions
   ✨ "Show teams in E-Commerce Platform"
   ✨ "List active work items by project"
   ↓
You click: Suggestion sent as new message
   ↓
Repeat with full context!
```

### Conversation Management
- **Create**: Click "New Conversation" in sidebar
- **Switch**: Click any conversation in sidebar
- **Continue**: Conversations load with full history
- **Delete**: Hover over conversation, click delete icon

## Example Conversations

### Conversation 1: Exploring Projects
```
User: "list all projects"
AI: [Shows 5 projects in a table]
    ✨ Show teams in E-Commerce Platform
    ✨ List active work items by project

User: [Clicks "Show teams in E-Commerce Platform"]
AI: [Shows 3 teams with details]
    ✨ Show active bugs for Frontend team
    ✨ What's the current sprint?

User: [Clicks "Show active bugs for Frontend team"]
AI: [Shows 12 bugs for Frontend team]
    ✨ Show P1 bugs only
    ✨ Group bugs by assignee
```

### Conversation 2: Sprint Planning
```
User: "what's in the current sprint?"
AI: [Shows sprint items]
    ✨ Show sprint burn-down
    ✨ List unassigned items
    ✨ Show P1 and P2 items only

User: "show me team velocity"
AI: [Shows velocity chart]
    ✨ Compare to last 3 sprints
    ✨ Show velocity by team member
```

## Technical Details

### Architecture
```
ConversationalChat (Main Component)
   ↓
├─ ConversationSidebar (Left)
│  ├─ List of conversations
│  ├─ New conversation button
│  └─ Delete conversation
│
└─ Chat Area (Right)
   ├─ ChatArea (Messages + Suggestions)
   └─ MessageInput (Send messages)
```

### Data Flow
```
User Message
   ↓
Collection Detection → Fetch Data (if needed)
   ↓
Send to Claude API with Context
   ↓
Stream Response → Save to Redis
   ↓
Generate Suggestions → Stream to Client
   ↓
Display Message + Suggestions
```

### Storage (Redis)
All conversations are stored in Redis with:
- **User isolation**: Each user sees only their conversations
- **Message history**: Full conversation context
- **Metadata**: Title, timestamps, token counts
- **TTL**: 30-day expiration (refreshed on activity)

### Authentication
- **Login required**: Must be authenticated to use chat
- **Session-based**: Uses secure HTTP-only cookies
- **User-specific**: Conversations tied to your email

## Benefits

### For Users
1. **Simpler**: One interface, no mode switching
2. **Smarter**: AI understands context across conversation
3. **Persistent**: Never lose your exploration history
4. **Guided**: Follow-up suggestions help you discover insights
5. **Natural**: Ask questions in plain English

### For Developers
1. **Maintainable**: Single codebase, not two
2. **Scalable**: Redis-based storage
3. **Extensible**: Easy to add new features
4. **Observable**: Clear logs and error handling
5. **Testable**: Unified testing surface

## Migration Notes

### What Was Removed
- ❌ `ChatModeWrapper` - Mode toggle component
- ❌ Quick Search mode
- ❌ Non-persistent chat interface
- ❌ Mode switching in localStorage

### What Stayed
- ✅ All AI capabilities
- ✅ Collection detection and fetching
- ✅ Beautiful UI styling
- ✅ User authentication
- ✅ Suggestion generation

### What Was Added
- ✅ Auto-create conversation on load
- ✅ Welcome message for new conversations
- ✅ Smoother conversation management
- ✅ Better loading states

## Configuration

### Environment Variables
```env
ANTHROPIC_API_KEY=sk-ant-...    # Required for Claude AI
ADO_PAT=...                      # Azure DevOps access
REDIS_URL=redis://...            # Redis for conversations
NEXT_PUBLIC_ADO_ORGANIZATION=... # Your ADO org
```

### Redis Schema
```
Keys:
- conversation:{id} - Conversation metadata (hash)
- conversation:{id}:messages - Messages (sorted set)
- user:{email}:conversations - User's conversation list (sorted set)

TTL: 30 days (refreshed on activity)
```

## Testing

### Test the Unified Experience
1. **Load ADO Explorer** - Should auto-create conversation
2. **See welcome message** - Should appear immediately
3. **Ask questions** - Try "list all projects"
4. **See suggestions** - Should appear after response
5. **Click suggestion** - Should send as new message
6. **Create new conversation** - Should work from sidebar
7. **Switch conversations** - Should load history
8. **Reload page** - Should maintain state

### Expected Behavior
✅ One conversation auto-created on load
✅ Welcome message shows helpful tips
✅ All queries return results with suggestions
✅ Clicking suggestions sends them as messages
✅ Conversations save automatically
✅ Sidebar shows conversation list
✅ Can switch between conversations
✅ Context maintained across messages

## Troubleshooting

### No conversation created?
**Check:**
- Redis is running
- ANTHROPIC_API_KEY is set
- User is authenticated
- Check console for errors

### Messages not saving?
**Check:**
- Redis connection
- Conversation ID is valid
- Check API logs: `[Messages API]`, `[Conversation Service]`

### Welcome message not showing?
**Check:**
- New conversation has 0 messages
- `loadConversation` is being called
- Welcome message logic in code

## Future Enhancements

Possible improvements:
1. **Search conversations** - Find past conversations by content
2. **Export conversations** - Download as markdown or PDF
3. **Share conversations** - Share read-only link
4. **Conversation templates** - Pre-built query sequences
5. **Voice input** - Speak your questions
6. **Multi-user conversations** - Collaborate with team
7. **Conversation analytics** - See usage patterns

## Summary

✨ **ADO Explorer now has a unified, conversational experience**:

- **One system** - No more mode switching
- **Automatic saving** - Everything persists
- **AI-powered** - Natural language queries
- **Context-aware** - Remembers your conversation
- **Guided exploration** - Smart suggestions
- **Beautiful UI** - Clean, intuitive interface

All interactions are now conversations that are **automatically saved**, **context-aware**, and **enhanced with AI suggestions**!

**Ready to explore!** Just open ADO Explorer and start asking questions in plain English. Your AI assistant is ready to help! 🚀
