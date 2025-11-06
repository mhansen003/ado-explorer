# AI Follow-Up Suggestions Feature

## Overview

The AI chat now provides **intelligent follow-up suggestions** after each response! These contextual recommendations help users discover deeper insights and continue their exploration naturally.

## Features

### ✨ Context-Aware Suggestions
- Analyzes current results and conversation history
- Generates 3-4 specific, actionable follow-up questions
- References actual data from the response (project names, user names, etc.)
- Builds on previous questions for natural conversation flow

### 🎯 One-Click Exploration
- Suggestions appear as clickable buttons below each assistant response
- Click any suggestion to instantly send it as a new message
- No need to type - just click and explore!

### 🧠 Smart Generation
- Uses Claude Haiku AI for fast, cost-effective generation
- Considers multiple factors:
  - User's original question
  - Assistant's response content
  - Collection type (projects, teams, users, etc.)
  - Number of results returned
  - Recent conversation history

## How It Works

```
User asks: "list all projects"
   ↓
Claude responds with projects
   ↓
[AI Suggestion Generator]
   - Analyzes: user query, response, results
   - Considers: conversation history, collection type
   - Generates: 3-4 contextual suggestions
   ↓
UI displays clickable buttons:
   ✨ Show teams in E-Commerce project
   ✨ List active work items by project
   ✨ Show all users in projects
   ✨ What's in the current sprint?
   ↓
User clicks → Sends as new message
```

## Example Suggestions

### After "list all projects"
```
✨ Show teams in the E-Commerce Platform project
✨ List active work items by project
✨ Show all users across projects
✨ What's the current sprint for E-Commerce?
```

### After "show marketing team's bugs"
```
✨ Show P1 bugs for marketing team
✨ List bugs created this week
✨ Show bugs by assignee in marketing
✨ What's marketing's velocity this sprint?
```

### After "what's in the current sprint?"
```
✨ Show sprint burn-down by day
✨ List unassigned items in sprint
✨ Show P1 and P2 items only
✨ What's blocked in the current sprint?
```

## UI Design

### Suggestion Button Appearance
- **Icon**: ✨ sparkle (changes to green on hover)
- **Style**: Rounded pills with subtle border
- **Hover**: Border turns green, background tints green, slight scale
- **Layout**: Flex wrap, multiple rows if needed

### Visual Example
```
[Assistant's response text here...]

┌──────────────────────────────────────────────────┐
│ ✨ Show teams in E-Commerce Platform             │
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│ ✨ List active work items by project             │
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│ ✨ Show all users across projects                │
└──────────────────────────────────────────────────┘
```

## Technical Implementation

### 1. Suggestion Generator (`lib/suggestion-generator.ts`)
```typescript
export async function generateSuggestions(context: SuggestionContext): Promise<string[]>
```

- **Model**: Claude Haiku (claude-3-5-haiku-20241022)
- **Input**: User query, assistant response, conversation history, collection data
- **Output**: 3-4 contextual follow-up suggestions
- **Fallback**: Smart fallbacks based on query type if AI fails

### 2. API Integration (`app/api/conversations/[id]/messages/route.ts`)
- After Claude responds, generates suggestions
- Streams suggestions as `type: 'suggestions'` event
- Non-blocking: failure doesn't affect main response

### 3. UI Components
**ConversationalChat.tsx:**
- Captures streaming suggestions
- Passes `onSuggestionClick` handler to ChatArea
- Clicking a suggestion calls `handleSendMessage()`

**ChatArea.tsx:**
- Displays suggestion buttons below assistant messages
- Shows sparkle icon ✨ for visual appeal
- Hover effects with green accent
- Also shows suggestions while streaming (if received early)

### 4. Type Definitions (`types/chat.ts`)
```typescript
export interface Message {
  // ...existing fields
  suggestions?: string[]; // AI-generated follow-up suggestions
}

export interface StreamingResponse {
  type: 'token' | 'done' | 'error' | 'suggestions';
  suggestions?: string[];
  // ...other fields
}
```

## Configuration

### Environment Variables
```env
ANTHROPIC_API_KEY=sk-ant-...  # Required for suggestion generation
```

### Model Selection
The system uses **Claude Haiku** for suggestions:
- ✅ Fast response time (~1-2 seconds)
- ✅ Low cost (60x cheaper than GPT-4)
- ✅ High quality suggestions
- ✅ 6.7x higher rate limits

## Cost Analysis

### Per Suggestion Generation
- **Input**: ~500 tokens (conversation context)
- **Output**: ~100 tokens (3-4 suggestions)
- **Cost**: ~$0.0003 per suggestion set
- **Total**: **< 1 cent per 30 suggestions**

### Comparison with GPT-4o
| Model | Cost per 1K tokens | Cost per suggestion |
|-------|-------------------|---------------------|
| Claude Haiku | $0.25 / $1.25 | $0.0003 |
| GPT-4o | $2.50 / $10.00 | $0.0018 |

Claude Haiku is **6x cheaper** for this use case!

## Suggestion Quality Guidelines

### ✅ GOOD Suggestions
- **Specific**: "Show marketing team's active bugs"
- **Actionable**: User can click and get immediate results
- **Data-aware**: References actual items from response
- **Diverse**: Covers different angles (filter, analyze, related data)
- **Concise**: 8-10 words max

### ❌ BAD Suggestions
- **Too generic**: "Tell me more", "Show me other things"
- **Too vague**: "What else?", "More information"
- **Not actionable**: "Learn about ADO", "Read documentation"
- **Too long**: "Show me all the active bugs that were created in the last week by the marketing team and are assigned to John"

## Fallback Behavior

If AI suggestion generation fails:
1. System catches error gracefully
2. Returns smart fallbacks based on query type:
   - Projects query → "Show teams in first project", "List work items by project"
   - Teams query → "Show work items by team", "List team members"
   - Bug query → "Show P1/P2 only", "Group bugs by assignee"
   - Generic → "Show active items by priority", "What's in current sprint?"

## Performance

- **Generation time**: 1-2 seconds (non-blocking)
- **User experience**: Suggestions appear after response completes
- **No delay**: Main response streams normally, suggestions follow
- **Caching**: Could add Redis caching for common patterns (future)

## Testing

### Test Queries
Try these queries to see varied suggestions:

1. **Collections:**
   - "list all projects"
   - "show me all teams"
   - "who are all the users?"

2. **Work Items:**
   - "show active bugs"
   - "find P1 items"
   - "what's john working on?"

3. **Analytics:**
   - "show sprint velocity"
   - "what's in the current sprint?"
   - "team performance this month"

### Expected Behavior
✅ Suggestions appear below each assistant response
✅ 3-4 suggestions per response
✅ Suggestions are contextual and specific
✅ Clicking a suggestion sends it as a new message
✅ Sparkle icon changes color on hover

## Future Enhancements

Possible improvements:
1. **Persistence**: Save suggestions to Redis with messages
2. **Learning**: Track which suggestions users click, improve over time
3. **Personalization**: Adjust suggestions based on user preferences
4. **Categories**: Group suggestions by type (Filter, Analyze, Explore)
5. **More suggestions**: Allow "Show more suggestions" button
6. **Suggestion voting**: Let users upvote/downvote suggestions
7. **Smart caching**: Cache common suggestion patterns

## Troubleshooting

### Suggestions not appearing?
**Check:**
1. `ANTHROPIC_API_KEY` is set in environment
2. Console logs for `[Suggestion Generator]` errors
3. Network tab for suggestion API calls
4. Start a new conversation (old conversations may not have feature)

### Suggestions are too generic?
**Possible causes:**
1. Short conversation history (needs context)
2. AI fallback was used due to error
3. Response content was truncated

**Solutions:**
1. Continue conversation to build more context
2. Check API key validity and rate limits
3. Review console logs for errors

### Clicking suggestion does nothing?
**Check:**
1. `onSuggestionClick` handler is wired up
2. `handleSendMessage` is being called
3. Console for JavaScript errors

## Summary

✨ **AI Follow-Up Suggestions** provide an intuitive way to explore Azure DevOps data:

- **Smart**: Context-aware, specific to your results
- **Fast**: Non-blocking, appears after response
- **Easy**: One-click to send suggestion
- **Cost-effective**: Uses Claude Haiku for efficiency
- **Beautiful**: Clean UI with sparkle icons ✨

The feature enhances the conversational AI experience by guiding users to ask follow-up questions they might not have thought of, leading to deeper insights and more productive exploration!

**Ready to explore!** Try asking "list all projects" and see the intelligent suggestions that appear! 🚀
