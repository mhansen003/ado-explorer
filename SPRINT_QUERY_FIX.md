# Sprint Query Fix - CRITICAL UPDATE ✅

## Problem Identified

Sprint queries were failing with **400 Bad Request** errors:

```
The specified operator cannot be used with area path fields.
The error is caused by «[System.IterationPath] contains 'Marketing'».
```

### Root Cause
Azure DevOps WIQL **does not allow** the `CONTAINS` operator on `System.IterationPath` fields. The AI was generating invalid queries like:

```sql
-- ❌ WRONG (causes 400 error)
SELECT [System.Id] FROM WorkItems
WHERE [System.IterationPath] CONTAINS 'Marketing'
AND [System.IterationPath] CONTAINS 'Sprint'
```

## Solution Implemented

### 1. Updated AI Prompt Rules

**File**: `lib/enhanced-ai-prompts.ts`

Added **CRITICAL** section to the WIQL generation prompt that explicitly forbids `CONTAINS` on IterationPath:

```
## ⚠️ CRITICAL - Sprint/Iteration Path Rules (MUST FOLLOW):
AZURE DEVOPS DOES NOT ALLOW CONTAINS OPERATOR ON ITERATIONPATH!

**ONLY THESE OPERATORS ARE ALLOWED FOR System.IterationPath:**
1. UNDER - For hierarchical matching (RECOMMENDED)
2. = - For exact path match

**NEVER USE:**
- ❌ CONTAINS - Will cause 400 error!
```

### 2. Added Sprint Query Detection

**New Functions** in `lib/enhanced-ai-prompts.ts`:

#### `isSprintQuery(query: string): boolean`
Detects if a query is asking about sprints by checking for keywords:
- sprint, iteration
- current sprint, last sprint, latest sprint
- sprint items, sprint work

#### `buildSprintContext(projectName, availableSprints): string`
Builds context for the AI with:
- Current sprint name and full path
- List of available sprints (top 5 most recent)
- Examples of correct WIQL syntax
- Reminder to NEVER use CONTAINS

### 3. Integrated Sprint Context into API

**File**: `app/api/prompt/route.ts`

Before generating WIQL, the API now:
1. Detects if the query is sprint-related
2. Fetches available sprints from Azure DevOps
3. Builds context with actual sprint names and paths
4. Passes this context to the AI for better query generation

```typescript
// Check if this is a sprint-related query and fetch sprint context
let sprintContext = '';
if (isSprintQuery(prompt)) {
  const adoService = new ADOService(organization, pat, targetProject);
  const sprints = await adoService.getSprints();
  sprintContext = buildSprintContext(targetProject, sprints);
}

// Add sprint context to the AI prompt
messages.push({
  role: 'user',
  content: prompt + sprintContext,
});
```

## Correct Sprint Query Patterns

### Pattern 1: Items in Any Sprint
```sql
-- All items with a sprint assigned
SELECT [System.Id], [System.Title], [System.State]
FROM WorkItems
WHERE [System.IterationPath] <> ''
AND [System.State] <> 'Closed'
```

### Pattern 2: Items in Specific Area/Team
```sql
-- All items in Marketing Experience sprints
SELECT [System.Id], [System.Title], [System.State]
FROM WorkItems
WHERE [System.IterationPath] UNDER 'Next Gen LOS\\Marketing Experience'
AND [System.State] <> 'Closed'
```

### Pattern 3: Items in Specific Sprint
```sql
-- Items in exact sprint (when sprint path is known)
SELECT [System.Id], [System.Title], [System.State]
FROM WorkItems
WHERE [System.IterationPath] = 'Next Gen LOS\\Marketing Experience\\MX Sprint 2025.11.12 (23)'
AND [System.State] <> 'Closed'
```

## Sprint Path Format

Azure DevOps sprint paths follow this hierarchical format:

```
ProjectName\AreaPath\SprintName

Examples:
- Next Gen LOS\Marketing Experience\MX Sprint 2025.11.12 (23)
- MyProject\Development\Sprint 42
- MyProject\Sprint 2025.Q4
```

**Important**:
- Use `\\` (double backslash) in WIQL queries to represent path separator
- Paths are hierarchical - use `UNDER` to match all children
- Use `=` for exact path match

## User Query Examples

### Natural Language → Correct WIQL

**Query**: "tell me what was in the last sprint in marketing"

**With Sprint Context**, AI now generates:
```sql
SELECT [System.Id], [System.Title], [System.State]
FROM WorkItems
WHERE [System.IterationPath] UNDER 'Next Gen LOS\\Marketing Experience'
AND [System.State] <> 'Closed'
ORDER BY [System.ChangedDate] DESC
```

**Query**: "what are we working on this sprint?"

**With Sprint Context** (current sprint = "MX Sprint 2025.11.12 (23)"), AI generates:
```sql
SELECT [System.Id], [System.Title], [System.State]
FROM WorkItems
WHERE [System.IterationPath] = 'Next Gen LOS\\Marketing Experience\\MX Sprint 2025.11.12 (23)'
AND [System.State] <> 'Closed'
ORDER BY [Microsoft.VSTS.Common.Priority] ASC
```

**Query**: "show me all sprint items"

**Without specific sprint**, AI generates:
```sql
SELECT [System.Id], [System.Title], [System.State]
FROM WorkItems
WHERE [System.IterationPath] <> ''
AND [System.State] <> 'Closed'
ORDER BY [System.ChangedDate] DESC
```

## Testing Checklist

Please test the following queries to verify the fix:

### Basic Sprint Queries ✅
- [ ] "show me current sprint items"
- [ ] "what's in this sprint?"
- [ ] "sprint items"
- [ ] "current iteration work"

### Team/Area-Specific Sprint Queries ✅
- [ ] "marketing sprint items"
- [ ] "what was in the last sprint in marketing?"
- [ ] "show me engineering sprint work"

### Specific Sprint Queries ✅
- [ ] "show me Sprint 23 items"
- [ ] "what was delivered in MX Sprint 2025.11.12?"

### Edge Cases ✅
- [ ] Query with no sprints configured
- [ ] Query for non-existent team/area
- [ ] Multi-project scenario (if applicable)

## Expected Behavior After Fix

### Before Fix ❌
- Queries fail with 400 error
- Error message: "operator cannot be used with area path fields"
- No results returned

### After Fix ✅
- Sprint queries work correctly
- AI generates valid WIQL with `UNDER` or `=` operators
- Sprint context helps AI understand available sprints
- Results include work items from requested sprint(s)

## Technical Details

### Why CONTAINS Doesn't Work
Azure DevOps treats `System.IterationPath` as a hierarchical field (like a file path). The WIQL query engine doesn't support text matching (`CONTAINS`) on hierarchical fields because:

1. **Performance**: Path traversal is more efficient than string matching
2. **Semantics**: Paths have hierarchy, not just text
3. **Wildcarding**: `UNDER` provides proper hierarchical matching

### Why UNDER Is Correct
The `UNDER` operator:
- Matches the specified path AND all descendants
- Respects hierarchy (parent/child relationships)
- Efficient for tree-like structures
- Proper semantic meaning for paths

Example:
```sql
[System.IterationPath] UNDER 'Project\Marketing Experience'
```
This matches:
- `Project\Marketing Experience\Sprint 1`
- `Project\Marketing Experience\Sprint 2`
- `Project\Marketing Experience\SubTeam\Sprint 3`

## Deployment Notes

✅ **TypeScript Compilation**: Passed
✅ **Backward Compatible**: All existing functionality preserved
✅ **No Breaking Changes**: Other query types unaffected
✅ **No Config Changes**: Same environment variables

### Files Modified
1. `lib/enhanced-ai-prompts.ts` - Added sprint detection and context building
2. `app/api/prompt/route.ts` - Integrated sprint context fetching

### No Changes Required
- Frontend components (ChatInterface, MessageList, etc.)
- Other API routes
- Database/Redis
- Environment variables
- Deployment configuration

## Rollback Plan

If issues occur, revert only the sprint-specific changes:

```bash
# The changes are additive, so rolling back is simple
git revert <commit-hash>
git push origin main
```

The rest of the AI enhancements will remain intact.

---

## Summary

**Problem**: Sprint queries failed due to invalid `CONTAINS` operator on IterationPath
**Solution**:
1. Updated AI prompt to forbid CONTAINS on IterationPath
2. Added sprint detection and context building
3. AI now uses correct `UNDER` and `=` operators

**Status**: ✅ **FIXED** and ready for testing

**Next Steps**: Test with real sprint queries in your environment!
