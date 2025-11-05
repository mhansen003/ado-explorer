# MCP Integration Migration Plan

## ⚠️ CRITICAL FEATURES TO PRESERVE

### 1. Natural Language Queries (MUST NOT BREAK)
- **Route**: `/api/prompt`
- **Flow**: User question → AI converts to WIQL → Execute query → Return work items + conversational answer
- **Features**:
  - Query type detection (SEARCH vs ANALYTICS)
  - Conversational AI responses
  - Sprint velocity analytics
  - Context-aware answers (loads all non-closed items for context)
  - Rate limiting and retry logic

### 2. Direct Search Commands
- **Route**: `/api/search`
- **Slash Commands**: `/created_by`, `/assigned_to`, `/state`, `/type`, `/tag`, `/sprint`, `/current-sprint`, `/id`, `/board`, `/project`, `/query`, `/recent`
- **Features**:
  - Global filters (ignore closed, ignore states, ignore created by, only my tickets, date filters)
  - WIQL query building
  - Sprint detection

### 3. AI Actions
- **Route**: `/api/ai-actions`
- **Actions**:
  - Release notes generation
  - Summary generation
  - Test cases generation
  - Acceptance criteria
  - Complexity analysis
  - **Related items finding** (uses ADO relationships API + AI suggestions)

### 4. Data Fetching Routes
- `/api/projects` - Get all projects
- `/api/boards` - Get all teams/boards
- `/api/users` - Get all users
- `/api/states` - Get work item states
- `/api/types` - Get work item types
- `/api/tags` - Get unique tags
- `/api/sprints` - Get sprints/iterations
- `/api/queries` - Get saved queries
- `/api/comments` - Get work item comments

### 5. Query Execution
- **Route**: `/api/run-query`
- Execute saved ADO queries by ID

### 6. Analytics
- Sprint velocity calculation
- Team metrics
- Velocity trends
- Cycle time calculation

---

## MCP TOOLS MAPPING

### ✅ Direct MCP Replacements Available
| Current ADOService Method | MCP Tool | Status |
|--------------------------|----------|--------|
| `searchWorkItems(wiql)` | `mcp__azure-devops__search_work_items` | ✅ Direct replacement |
| `getProjects()` | `mcp__azure-devops__get_projects` | ✅ Direct replacement |
| `getTeams()` | `mcp__azure-devops__get_teams` | ✅ Direct replacement |
| `getUsers()` | `mcp__azure-devops__get_users` | ✅ Direct replacement |
| `getStates()` | `mcp__azure-devops__get_states` | ✅ Direct replacement |
| `getTypes()` | `mcp__azure-devops__get_types` | ✅ Direct replacement |
| `getTags()` | `mcp__azure-devops__get_tags` | ✅ Direct replacement |

### ⚠️ No Direct MCP Replacement (Keep REST API)
| Current ADOService Method | Why No MCP | Solution |
|--------------------------|------------|----------|
| `getRelatedWorkItems()` | Complex relations API | Keep REST API for now |
| `getComments()` | Comments API | Keep REST API for now |
| `getSprints()` | Team iterations API | Keep REST API for now |
| `getQueries()` | Saved queries API | Keep REST API for now |
| `runQuery()` | Query execution | Keep REST API for now |
| `getCurrentSprint()` | Sprint detection logic | Keep REST API for now |

---

## MIGRATION STRATEGY

### Phase 1: Create Hybrid Service (CURRENT)
1. Create `ADOServiceHybrid` class that:
   - Uses MCP tools for basic data fetching (projects, teams, users, states, types, tags)
   - Uses MCP for WIQL search
   - Falls back to REST API for advanced features (relations, comments, sprints, queries)
   - Maintains exact same interface as current ADOService

### Phase 2: Test MCP Tools
1. Test each MCP tool individually
2. Verify response formats match current expectations
3. Test with global filters applied

### Phase 3: Gradual Migration
1. Start with simple routes: `/api/projects`, `/api/users`, `/api/states`, `/api/types`, `/api/tags`
2. Then migrate: `/api/boards` (teams)
3. Then migrate: `/api/search` (WIQL queries)
4. Finally migrate: `/api/prompt` (natural language queries)

### Phase 4: Verification
1. Test all slash commands
2. Test natural language queries
3. Test conversational AI responses
4. Test analytics queries
5. Test charts
6. Test AI actions

---

## ROLLBACK PLAN
- Keep original ADOService class intact
- ADOServiceHybrid is additive, not replacing
- Can switch back by changing imports
- All REST API code remains available

---

## TESTING CHECKLIST

### Basic Queries
- [ ] `/id 12345` - Direct ID lookup
- [ ] `/created_by John` - Filter by creator
- [ ] `/assigned_to Sarah` - Filter by assignee
- [ ] `/state Active` - Filter by state
- [ ] `/type Bug` - Filter by type
- [ ] `/tag important` - Filter by tag

### Natural Language
- [ ] "show me all active bugs"
- [ ] "what are the P1 items?"
- [ ] "find tasks assigned to john"
- [ ] "tickets created last week"

### Analytics
- [ ] "show me sprint velocity"
- [ ] "team performance this month"
- [ ] "velocity by iteration"

### AI Actions
- [ ] Generate release notes
- [ ] Find related items
- [ ] Generate test cases

### Charts
- [ ] Create pie chart by state
- [ ] Create bar chart by type
- [ ] Pivot chart data

### Global Filters
- [ ] Ignore closed tickets
- [ ] Ignore specific states
- [ ] Only my tickets
- [ ] Date range filters
