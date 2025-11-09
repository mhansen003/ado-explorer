# Microsoft Azure DevOps MCP Server - Complete Tool Mapping

## 📋 Tool Inventory

The Microsoft MCP server provides **80+ tools** across 9 domains. Below is the mapping from your current `ADOService` methods to MCP tools.

---

## 🔄 Current Method → MCP Tool Mapping

| Current ADOService Method | MCP Tool | Domain | Status |
|---------------------------|----------|--------|--------|
| `searchWorkItems(wiql)` | **search_workitem** | search | ✅ Direct replacement |
| `getWorkItem(id)` | **wit_get_work_item** | work-items | ✅ Direct replacement |
| `getProjects()` | **core_list_projects** | core | ✅ Direct replacement |
| `getTeams(project)` | **core_list_project_teams** | core | ✅ Direct replacement |
| `getSprints(project, team)` | **work_list_team_iterations** or **work_list_iterations** | work | ✅ Direct replacement |
| `getTypes(project)` | **wit_get_work_item_type** | work-items | ⚠️ Different approach |
| `getStates(project, type)` | **wit_get_work_item_type** | work-items | ⚠️ Included in type details |
| `getTags()` | ❌ No direct tool | N/A | ⚠️ Keep REST API |
| `getUsers()` | **core_get_identity_ids** | core | ⚠️ Partial (needs unique names) |
| `getQueries(project)` | **wit_get_query** | work-items | ✅ Direct replacement |
| `runQuery(project, queryId)` | **wit_get_query_results_by_id** | work-items | ✅ Direct replacement |
| `getComments(id)` | **wit_list_work_item_comments** | work-items | ✅ Direct replacement |
| `getRelatedWorkItems(id)` | ❌ No direct tool | N/A | ⚠️ Keep REST API |
| `getCurrentSprintWorkItems()` | **wit_get_work_items_for_iteration** | work-items | ✅ Direct replacement |
| `getAllNonClosedWorkItems()` | **wit_my_work_items** or **search_workitem** | work-items/search | ✅ Direct replacement |

---

## 🎯 Key MCP Tools for ADO Explorer

### **1. Work Item Search & Retrieval**

#### `search_workitem`
**Purpose:** Full-text search across work items (replaces WIQL for simple searches)
```typescript
Input: {
  searchText: string;
  $top?: number;
  $skip?: number;
  project?: string;
}
Output: {
  results: Array<{
    id: string;
    title: string;
    state: string;
    assignedTo: string;
    // ... other fields
  }>
}
```

#### `wit_get_work_item`
**Purpose:** Get single work item with full details
```typescript
Input: {
  id: number;
  $expand?: "relations" | "all" | "none";
}
Output: {
  id: number;
  fields: {
    "System.Title": string;
    "System.State": string;
    // ... all ADO fields
  };
  relations?: Array<{
    rel: string;
    url: string;
    attributes: object;
  }>;
}
```

#### `wit_get_work_items_batch_by_ids`
**Purpose:** Get multiple work items at once
```typescript
Input: {
  ids: number[];
  fields?: string[];
  asOf?: string;
  $expand?: string;
}
Output: {
  value: Array<WorkItem>;
}
```

#### `wit_get_work_items_for_iteration`
**Purpose:** Get all work items in a specific sprint/iteration
```typescript
Input: {
  project: string;
  team: string;
  iterationId: string;
}
Output: {
  workItems: Array<WorkItem>;
}
```

### **2. Project & Team Metadata**

#### `core_list_projects`
**Purpose:** List all projects in organization
```typescript
Input: {}
Output: {
  value: Array<{
    id: string;
    name: string;
    description: string;
    state: "wellFormed" | "createPending" | ...;
  }>
}
```

#### `core_list_project_teams`
**Purpose:** List teams for a project
```typescript
Input: {
  project: string;
}
Output: {
  value: Array<{
    id: string;
    name: string;
    url: string;
  }>
}
```

### **3. Sprint/Iteration Management**

#### `work_list_team_iterations`
**Purpose:** Get iterations for a specific team
```typescript
Input: {
  project: string;
  team: string;
  timeframe?: "current" | "past" | "future";
}
Output: {
  value: Array<{
    id: string;
    name: string;
    path: string;
    attributes: {
      startDate: string;
      finishDate: string;
      timeFrame: "current" | "past" | "future";
    };
  }>
}
```

#### `work_list_iterations`
**Purpose:** List all iterations in a project
```typescript
Input: {
  project: string;
}
Output: {
  value: Array<Iteration>;
}
```

### **4. Query Execution**

#### `wit_get_query`
**Purpose:** Get saved query by ID or path
```typescript
Input: {
  project: string;
  query: string; // Query ID or path
}
Output: {
  id: string;
  name: string;
  wiql: string;
  // ... query metadata
}
```

#### `wit_get_query_results_by_id`
**Purpose:** Execute a saved query and get results
```typescript
Input: {
  project: string;
  queryId: string;
}
Output: {
  workItems: Array<WorkItem>;
}
```

### **5. Comments & Relations**

#### `wit_list_work_item_comments`
**Purpose:** Get all comments on a work item
```typescript
Input: {
  project: string;
  workItemId: number;
}
Output: {
  comments: Array<{
    id: number;
    text: string;
    createdBy: IdentityRef;
    createdDate: string;
  }>
}
```

#### `wit_work_items_link`
**Purpose:** Create relationships between work items
```typescript
Input: {
  workItemId: number;
  linkType: "Parent" | "Child" | "Related";
  targetWorkItemId: number;
}
Output: {
  success: boolean;
}
```

---

## 🏗️ Integration Strategy

### **Tier 1: Must Use MCP** (Better than REST API)
- ✅ `search_workitem` - Full-text search with ranking
- ✅ `wit_get_work_items_for_iteration` - Sprint queries
- ✅ `work_list_team_iterations` - Sprint metadata with timeframes
- ✅ `core_list_projects` - Project listing
- ✅ `core_list_project_teams` - Team listing

### **Tier 2: Can Use MCP** (Equivalent to REST API)
- ✅ `wit_get_work_item` - Single work item retrieval
- ✅ `wit_get_work_items_batch_by_ids` - Batch retrieval
- ✅ `wit_get_query_results_by_id` - Saved query execution
- ✅ `wit_list_work_item_comments` - Comments

### **Tier 3: Keep REST API** (No MCP equivalent or MCP insufficient)
- ⚠️ Custom WIQL queries (use `searchWorkItems()` REST API)
- ⚠️ Tag extraction (no direct MCP tool)
- ⚠️ User listing (MCP only has identity lookup by name)
- ⚠️ Work item types/states (can use MCP but cumbersome)
- ⚠️ Relationship traversal (REST API $expand is simpler)

---

## 📦 Recommended MCP Configuration

Only load necessary domains to reduce startup time and token usage:

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "npx",
      "args": [
        "-y",
        "@azure-devops/mcp",
        "-d", "core,work,work-items,search"
      ],
      "env": {
        "ADO_PAT": "${ADO_PAT}",
        "ADO_ORGANIZATION": "${NEXT_PUBLIC_ADO_ORGANIZATION}"
      }
    }
  }
}
```

**Domains Needed:**
- `core` - Projects and teams
- `work` - Iterations/sprints
- `work-items` - Work items, queries, comments
- `search` - Full-text search

**Domains NOT Needed (for now):**
- `repositories` - Not used in current app
- `pipelines` - Not used in current app
- `test-plans` - Not used in current app
- `wiki` - Not used in current app
- `advanced-security` - Not used in current app

---

## 🔄 Migration Priority

### **Phase 1: High Impact** (Do First)
1. ✅ Sprint queries (`work_list_team_iterations` → `wit_get_work_items_for_iteration`)
2. ✅ Full-text search (`search_workitem` instead of WIQL for simple searches)
3. ✅ Project/team listing (`core_list_projects`, `core_list_project_teams`)

### **Phase 2: Medium Impact**
4. ✅ Saved query execution (`wit_get_query_results_by_id`)
5. ✅ Batch work item retrieval (`wit_get_work_items_batch_by_ids`)

### **Phase 3: Low Impact**
6. ⚠️ Comments (`wit_list_work_item_comments`)
7. ⚠️ Single work item get (`wit_get_work_item`)

### **Keep REST API:**
- Custom WIQL queries (too complex for MCP)
- Tag extraction
- Full user lists
- Relationship traversal with $expand

---

## 🎁 Benefits by MCP Tool

| MCP Tool | Benefit vs REST API |
|----------|---------------------|
| `search_workitem` | ✅ Relevance ranking, no WIQL needed |
| `work_list_team_iterations` | ✅ Includes timeframe (current/past/future) |
| `wit_get_work_items_for_iteration` | ✅ Direct sprint query, no WIQL path issues |
| `core_list_projects` | 🟰 Same as REST |
| `core_list_project_teams` | 🟰 Same as REST |
| `wit_get_work_item` | 🟰 Same as REST |
| `wit_list_work_item_comments` | 🟰 Same as REST |

---

## 📝 Next Steps

1. Create `MCPADOService` class with MCP tool calls
2. Implement hybrid `ADOServiceHybrid` with fallbacks
3. Update AI orchestrator to use Anthropic SDK with MCP tools
4. Test with real queries
5. Performance benchmark MCP vs REST

