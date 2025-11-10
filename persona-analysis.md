# ADO Explorer - Comprehensive Query Analysis

## Current Capabilities ✅

### Scope Types Supported:
**Primary:** SPRINT, USER, PROJECT, ISSUE, TEAM, BOARD, QUERY
**Field-Specific:** STATE, TYPE, TAG, PRIORITY, TITLE, DESCRIPTION, DATE_RANGE, ASSIGNEE, CREATOR, ITERATION, AREA, RELATION

### Query Patterns Working:
- "Show me John's active tickets"
- "Items in Sprint 23"
- "All bugs"
- "Items created by Sarah"
- "Closed user stories"
- "Items with tag 'urgent'"
- "Find work items with 'security' in title"
- "How many bugs are open?"

---

## Missing Capabilities by Persona ❌

### 👨‍💻 DEVELOPERS Need:

**Time-Based Queries:**
- "Items updated today/this week"
- "Items modified in the last 24 hours"
- "Stale items (no updates in 30 days)"
- "Overdue items"
- "Items due this week"

**Blocking/Dependencies:**
- "Items blocking me" (items I'm blocked by)
- "Items I'm blocking" (items blocked by my work)
- "Show all blocked items"
- "Items with dependencies"

**Work Context:**
- "Unassigned items in my area"
- "Items ready for code review"
- "Items awaiting my input"
- "Technical debt items"
- "Items without story points"

**Keywords:** blocked, blocking, overdue, due, stale, updated, modified, recently, unassigned, review, debt, estimate, points

---

### 📊 PRODUCT MANAGERS Need:

**Hierarchy Queries:**
- "Show epics with their features"
- "Features without user stories"
- "User stories for Epic #1234"
- "Orphaned tasks (no parent)"
- "Items under Feature X"

**Planning/Estimation:**
- "Unestimated stories"
- "Stories without acceptance criteria"
- "Items missing description"
- "Sprint capacity vs committed points"
- "Backlog items ready for sprint"

**Roadmap/Timeline:**
- "Items for Q1 2025"
- "Features planned for next release"
- "Milestone progress"
- "Items by target date"
- "Deliverables due this quarter"

**Quality/Completeness:**
- "Stories missing acceptance criteria"
- "Items without tags"
- "Features not assigned to a sprint"
- "Work items by business value"

**Keywords:** epic, feature, hierarchy, parent, child, unestimated, acceptance criteria, milestone, roadmap, release, quarter, backlog, ready, value

---

### 🧪 QA/TESTERS Need:

**Bug Analysis:**
- "Bugs by severity"
- "Critical/High priority bugs"
- "Regression bugs"
- "Reopened bugs"
- "Bugs without repro steps"
- "Bugs in production"

**Testing Workflow:**
- "Bugs ready for retest" (Resolved → Active)
- "Items pending testing"
- "Test cases"
- "Failed test cases"
- "Bugs by environment (dev/staging/prod)"

**Coverage:**
- "Features without test cases"
- "Untested user stories"
- "Test coverage gaps"

**Keywords:** severity, critical, regression, reopened, retest, test case, failed, environment, dev, staging, production, coverage, untested, repro, reproduction

---

### 💼 BUSINESS/STAKEHOLDERS Need:

**Project Health:**
- "Milestone progress"
- "Deliverable status"
- "Completion percentage"
- "Items at risk"
- "Red/yellow/green status"

**Timeline:**
- "Items past due date"
- "Upcoming deadlines"
- "Schedule variance"
- "Projected completion date"

**Resource Management:**
- "Team workload"
- "Resource allocation"
- "Items by cost center"
- "Budget tracking"

**Client/Customer:**
- "Items for Customer X"
- "Client-requested features"
- "External dependencies"

**Keywords:** milestone, deliverable, due date, deadline, at risk, schedule, timeline, completion, workload, resource, budget, customer, client, external

---

## Priority Additions (Most Impact)

### 🔥 HIGH PRIORITY:

1. **BLOCKED/BLOCKING scope** - Critical for developers
   - Keywords: blocked, blocking, impediment
   - WIQL: `[System.State] = 'Blocked'` or custom Blocked By field

2. **TIME_RELATIVE scope** - Universal need
   - Keywords: today, yesterday, this week, last week, this month, overdue, due
   - WIQL: `[System.ChangedDate] >= @Today-7` 

3. **HIERARCHY scope** - Essential for PMs
   - Keywords: epic, feature, parent, child, under, belongs to
   - WIQL: Relations API for Parent/Child links

4. **EFFORT scope** - Planning queries
   - Keywords: story points, effort, estimated, unestimated
   - WIQL: `[Microsoft.VSTS.Scheduling.StoryPoints]`

5. **MISSING_FIELD scope** - Data quality
   - Keywords: missing, without, empty, blank
   - WIQL: `[System.Description] = ''`

### 🟡 MEDIUM PRIORITY:

6. **SEVERITY scope** - QA needs
   - Keywords: severity, critical, sev1, sev2
   - WIQL: `[Microsoft.VSTS.Common.Severity]`

7. **ENVIRONMENT scope** - Testing context
   - Keywords: production, staging, dev, environment
   - Custom field or tag-based

8. **MILESTONE scope** - Business tracking
   - Keywords: milestone, deliverable, release
   - WIQL: `[System.Tags] CONTAINS 'Milestone'` or custom field

9. **RECENT_ACTIVITY scope** - Change tracking
   - Keywords: recently updated, recent changes, latest
   - WIQL: `ORDER BY [System.ChangedDate] DESC`

10. **WORKLOAD scope** - Resource management
    - Keywords: workload, capacity, assigned count
    - Aggregation: Group by AssignedTo

### 🟢 LOW PRIORITY (Nice to Have):

11. Test case specific queries
12. Comment/discussion queries
13. Attachment queries  
14. Custom field queries
15. Board column state queries

---

## Recommended Implementation Order

### Phase 1: Core Developer Experience
1. BLOCKED/BLOCKING
2. TIME_RELATIVE
3. RECENT_ACTIVITY

### Phase 2: Product Management
4. HIERARCHY
5. EFFORT (story points)
6. MISSING_FIELD

### Phase 3: QA/Testing
7. SEVERITY
8. ENVIRONMENT

### Phase 4: Business Intelligence
9. MILESTONE
10. WORKLOAD

