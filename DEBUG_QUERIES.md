# Debug: Common Query Issues

## 🔍 Help Me Help You!

To improve the AI's accuracy, I need to understand what's not working for you.

### Please provide examples:

**Format:**
```
Question: "your exact question"
Expected: "what you wanted to see"
Got: "what actually happened"
```

### Common Issues I Can Fix:

1. **User Context Problems**
   - "show me my tasks" → doesn't know who "me" is
   - "what am I working on?" → no user filter

2. **Sprint Issues**
   - "current sprint" → wrong sprint
   - "sprint 15" → can't find it

3. **Priority/Urgency**
   - "what's urgent?" → wrong items
   - "high priority" → inconsistent results

4. **Team Member Queries**
   - "john's tickets" → wrong person
   - "what is sarah doing?" → no results

5. **General Ambiguity**
   - Vague questions getting wrong interpretation

### Example Debug Session:

```
Question: "show me my current tasks"
Expected: Tasks assigned to Mark Hansen in current sprint
Got: All tasks across all sprints
Issue: AI doesn't know current user context

FIX: Add user context to every query
```

---

## Quick Wins I Can Implement:

### 1. **Add Current User Context**
```typescript
// Add to every AI prompt:
Current User: ${filters?.currentUser || 'Unknown'}

// This helps AI understand "my" and "me"
```

### 2. **Better Sprint Detection**
```typescript
// More aggressive sprint detection
if (prompt.includes('sprint') || prompt.includes('iteration') ||
    prompt.includes('current') || prompt.includes('this week')) {
  // Fetch sprint context
}
```

### 3. **Common Query Templates**
```typescript
// Pre-process common patterns
if (prompt === "my tasks" || prompt === "show me my tasks") {
  // Direct to optimized query
  return quickMyTasks(user);
}
```

### 4. **User Feedback Loop**
```typescript
// If AI returns 0 results, suggest alternatives
if (results.length === 0) {
  return "No results found. Did you mean: [suggestions]"
}
```

---

## Tell Me Your Pain Points!

**What queries fail most often for you?**

Once you give me examples, I can implement specific fixes that will make a huge difference!

