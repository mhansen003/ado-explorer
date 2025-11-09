# MCP Integration Analysis & Implementation Guide

## 📊 Current System Overview

### **Data Structures** (types/index.ts)

#### Core Work Item Interface
```typescript
interface WorkItem {
  id: string;
  title: string;
  type: string;  // Bug, Task, User Story, Feature, Epic
  state: string;  // New, Active, Resolved, Closed, etc.
  assignedTo: string;
  assignedToEmail?: string;
  createdBy: string;
  createdByEmail?: string;
  createdDate: string;
  closedDate?: string;
  priority: number;  // 1 (highest) - 4 (lowest)
  description?: string;
  tags?: string[];
  project?: string;
  changedDate?: string;
  changedBy?: string;
  changedByEmail?: string;
  iterationPath?: string;  // Sprint path: "Next Gen LOS\\Triad Sprint 15"
  areaPath?: string;
  storyPoints?: number;
  acceptanceCriteria?: string;
  relationType?: string;  // Parent, Child, Related
  relationSource?: 'linked' | 'tag' | 'title';
}
```

#### Analytics Data
```typescript
interface AnalyticsData {
  velocities: Array<{
    iteration: string;
    iterationPath: string;
    storyPointsCompleted: number;
    storyPointsPlanned: number;
    itemsCompleted: number;
    itemsPlanned: number;
    completionRate: number;
  }>;
  teamMetrics: {
    totalStoryPoints: number;
    completedStoryPoints: number;
    averageVelocity: number;
    teamMembers: string[];
    workItemsByMember: Record<string, number>;
    storyPointsByMember: Record<string, number>;
  };
  velocityTrends: {
    trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    changePercentage: number;
    consistency: number;
    recommendations: string[];
  };
  cycleTime: {
    averageDays: number;
    medianDays: number;
    byType: Record<string, number>;
  };
}
```

### **Current ADOService Methods** (lib/ado-api.ts)

| Method | Purpose | REST API Endpoint | Returns |
|--------|---------|-------------------|---------|
| `searchWorkItems(wiql)` | Execute WIQL query | POST `/wit/wiql` → GET `/wit/workitems` | `WorkItem[]` |
| `getAllNonClosedWorkItems()` | Get context for AI (500 items max) | POST `/wit/wiql` | `WorkItem[]` |
| `getWorkItem(id)` | Get single work item | GET `/wit/workitems/{id}` | `WorkItem \| null` |
| `getProjects()` | List all projects | GET `/projects` | `{id, name, description}[]` |
| `getTeams(project?)` | List teams/boards | GET `/projects/{project}/teams` | `{id, name, projectName}[]` |
| `getUsers()` | List all users | GET `/graph/users` | `{displayName, uniqueName}[]` |
| `getStates(project, type)` | Get work item states | GET `/wit/workitemtypes/{type}/states` | `{name, category, color}[]` |
| `getTypes(project)` | Get work item types | GET `/wit/workitemtypes` | `{name, description, icon}[]` |
| `getTags()` | Get unique tags | POST `/wit/wiql` | `string[]` |
| `getSprints(project?, team?)` | Get iterations/sprints | GET `/work/teamsettings/iterations` | Sprint array with dates |
| `getCurrentSprint(project, team)` | Get active sprint | Computed from `getSprints()` | Sprint object |
| `getCurrentSprintWorkItems()` | Get items in current sprint | POST `/wit/wiql` | `WorkItem[]` |
| `getQueries(project)` | Get saved queries | GET `/wit/queries` | Query tree |
| `runQuery(project, queryId)` | Execute saved query | GET `/wit/queries/{id}` → execute | `WorkItem[]` |
| `getComments(id)` | Get work item comments | GET `/wit/workitems/{id}/comments` | `Comment[]` |
| `getRelatedWorkItems(id)` | Get linked items | GET `/wit/workitems/{id}` (with $expand=relations) | `WorkItem[]` |
| `enrichWorkItemsWithRelationships()` | Add related items | Multiple API calls | Enhanced `WorkItem[]` |

### **Current Field Mappings**

ADO API Response → WorkItem Interface:
```typescript
// Azure DevOps REST API Fields (from response.fields)
System.Id → id
System.Title → title
System.WorkItemType → type
System.State → state
System.AssignedTo.displayName → assignedTo
System.AssignedTo.uniqueName → assignedToEmail
System.CreatedBy.displayName → createdBy
System.CreatedBy.uniqueName → createdByEmail
System.CreatedDate → createdDate
Microsoft.VSTS.Common.ClosedDate → closedDate
Microsoft.VSTS.Common.Priority → priority (default: 3)
System.Description → description
System.Tags → tags (split by ';')
System.TeamProject → project
System.ChangedDate → changedDate
System.ChangedBy.displayName → changedBy
System.ChangedBy.uniqueName → changedByEmail
System.IterationPath → iterationPath
System.AreaPath → areaPath
Microsoft.VSTS.Scheduling.StoryPoints → storyPoints
Microsoft.VSTS.Common.AcceptanceCriteria → acceptanceCriteria
```

---

## 🎯 Microsoft MCP Server Integration Plan

### **Phase 1: Installation & Setup**

#### 1.1 Install MCP Server
```bash
npm install @azure-devops/mcp
npm install @anthropic-ai/sdk  # If not already installed
```

#### 1.2 Configure MCP Server

**Option A: Global Configuration** (~/.claude.json)
```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "npx",
      "args": [
        "-y",
        "@azure-devops/mcp"
      ],
      "env": {
        "ADO_PAT": "your-pat-token",
        "ADO_ORGANIZATION": "cmgfidev"
      }
    }
  }
}
```

**Option B: Project-Level Configuration** (.mcp.json in project root)
```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp"],
      "env": {
        "ADO_PAT": "${ADO_PAT}",
        "ADO_ORGANIZATION": "${NEXT_PUBLIC_ADO_ORGANIZATION}"
      }
    }
  }
}
```

### **Phase 2: Understand MCP Server Tools**

According to Microsoft documentation, the MCP server provides these tools:

| MCP Tool | Purpose | Equivalent Current Method |
|----------|---------|---------------------------|
| `search_work_items` | Execute WIQL queries | `searchWorkItems()` |
| `get_work_item` | Get single work item details | `getWorkItem()` |
| `get_projects` | List all projects | `getProjects()` |
| `get_teams` | List teams in a project | `getTeams()` |
| `get_iterations` | List sprints/iterations | `getSprints()` |
| `get_work_item_types` | List work item types | `getTypes()` |
| `get_pull_requests` | List PRs (not currently used) | N/A |
| `create_work_item` | Create new work item | N/A (not currently used) |
| `update_work_item` | Update work item | N/A (not currently used) |

### **Phase 3: Create MCP Integration Layer**

#### 3.1 New Service: `MCPADOService`

Create `lib/mcp-ado-service.ts` that:
- Uses Anthropic SDK with MCP tools
- Maintains same interface as `ADOService`
- Falls back to REST API for unsupported operations
- Handles tool calling and response parsing

#### 3.2 Hybrid Approach

```typescript
class ADOServiceHybrid {
  private mcpService: MCPADOService;
  private restService: ADOService;

  async searchWorkItems(wiql: string): Promise<WorkItem[]> {
    try {
      // Try MCP first
      return await this.mcpService.searchWorkItems(wiql);
    } catch (error) {
      console.warn('MCP failed, falling back to REST API');
      return await this.restService.searchWorkItems(wiql);
    }
  }

  // ... other methods with same pattern
}
```

### **Phase 4: Update AI Orchestrator**

#### Current Flow (OpenAI)
```
User Query → IntentAnalyzer (OpenAI GPT-4o-mini)
  → DecisionEngine → QueryPlanner (GPT-4o)
  → QueryExecutor (ADOService REST calls)
  → ResultEvaluator → ResponseSynthesizer (GPT-4o)
```

#### New Flow (Anthropic + MCP)
```
User Query → IntentAnalyzer (Claude Haiku with MCP context)
  → DecisionEngine → QueryPlanner (Claude Sonnet + MCP metadata tools)
  → QueryExecutor (Claude + MCP work item tools)
  → ResultEvaluator → ResponseSynthesizer (Claude Sonnet)
```

**Key Changes:**
1. Replace `openai` SDK with `@anthropic-ai/sdk`
2. Add tool definitions for MCP server
3. Let Claude call MCP tools dynamically
4. Parse tool results and map to `WorkItem[]`

---

## 🔧 Type Mappings: MCP Response → WorkItem

### Expected MCP Response Format
Based on Microsoft's MCP implementation and Azure DevOps API:

```typescript
// MCP search_work_items response
{
  "workItems": [
    {
      "id": 12345,
      "fields": {
        "System.Title": "Fix authentication bug",
        "System.WorkItemType": "Bug",
        "System.State": "Active",
        "System.AssignedTo": {
          "displayName": "John Doe",
          "uniqueName": "john@example.com"
        },
        // ... all fields similar to REST API
      },
      "relations": [...]  // If $expand=relations
    }
  ]
}
```

**Mapping Function:**
```typescript
function mapMCPResponseToWorkItems(mcpResponse: any): WorkItem[] {
  return mcpResponse.workItems.map(item => ({
    id: item.id.toString(),
    title: item.fields['System.Title'] || 'Untitled',
    type: item.fields['System.WorkItemType'] || 'Unknown',
    state: item.fields['System.State'] || 'Unknown',
    assignedTo: item.fields['System.AssignedTo']?.displayName || 'Unassigned',
    assignedToEmail: item.fields['System.AssignedTo']?.uniqueName,
    // ... same mapping as current ADOService.mapToWorkItem()
  }));
}
```

---

## 📋 Implementation Checklist

### Phase 1: Setup ✅
- [ ] Install @azure-devops/mcp package
- [ ] Install @anthropic-ai/sdk package
- [ ] Configure MCP server in .mcp.json
- [ ] Test MCP server connection
- [ ] Document available MCP tools

### Phase 2: Integration Layer 🔄
- [ ] Create `lib/mcp-ado-service.ts`
- [ ] Implement `searchWorkItems()` with MCP
- [ ] Implement `getProjects()` with MCP
- [ ] Implement `getTeams()` with MCP
- [ ] Implement `getSprints()` with MCP
- [ ] Add fallback to REST API for all methods
- [ ] Create type mapping utilities
- [ ] Add comprehensive error handling

### Phase 3: AI Orchestrator Updates 🔄
- [ ] Replace OpenAI SDK with Anthropic SDK
- [ ] Update IntentAnalyzer to use Claude
- [ ] Update QueryPlanner to use Claude + MCP tools
- [ ] Update QueryExecutor to use MCPADOService
- [ ] Update ResponseSynthesizer to use Claude
- [ ] Maintain backward compatibility with existing API

### Phase 4: Testing & Validation 🧪
- [ ] Test basic work item search
- [ ] Test sprint queries
- [ ] Test user/team queries
- [ ] Test analytics calculations
- [ ] Test fallback scenarios
- [ ] Compare MCP vs REST API responses
- [ ] Performance benchmarking

### Phase 5: Migration 🚀
- [ ] Update environment variables
- [ ] Deploy to development
- [ ] Monitor for issues
- [ ] Gradual rollout
- [ ] Document new architecture

---

## 🎁 Expected Benefits

### 1. **Consistency**
- Microsoft's official tooling handles ADO API quirks
- Better sprint path resolution
- Reduced WIQL generation errors

### 2. **Flexibility**
- AI can dynamically fetch metadata as needed
- No need to pre-load sprint lists into prompts
- Reduced token usage

### 3. **Maintainability**
- Less custom code to maintain
- Official support from Microsoft
- Regular updates and bug fixes

### 4. **Performance**
- Fewer manual API calls
- Better caching strategies
- Optimized data fetching

---

## 🚨 Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| MCP server unavailable | Fallback to REST API |
| Different response format | Comprehensive type mapping + tests |
| Performance degradation | Benchmark and optimize |
| Breaking changes in MCP | Version pinning + monitoring |
| Learning curve | Thorough documentation |

---

## 📚 Next Steps

1. ✅ **Install MCP server** - `npm install @azure-devops/mcp`
2. ✅ **Test connection** - Verify MCP server can connect to ADO
3. 🔄 **Build integration layer** - Create MCPADOService
4. 🔄 **Update orchestrator** - Integrate Anthropic SDK
5. 🧪 **Test end-to-end** - Sample queries with MCP
6. 🚀 **Deploy gradually** - Feature flag for MCP vs REST

