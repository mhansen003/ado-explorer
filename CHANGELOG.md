# Changelog

All notable changes to ADO Explorer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2025-01-05

### ✨ Added
- **Automatic relationship detection in search results** - Work items now automatically show parent/child relationships
  - When you search for items (e.g., "get all marketing items"), the system detects relationships between items
  - Parent/child relationships are automatically identified and populated
  - Hierarchical tree view displays automatically when relationships exist
  - No need to click individual items to discover related work items

### 🔧 Technical Implementation
- **New enrichWorkItemsWithRelationships() method** in ADOService
  - Fetches relations for all work items in parallel for performance
  - Checks if related work item IDs exist within the result set
  - Populates relationType field (Parent, Child, Related, Predecessor, Successor)
  - Sets relationSource to 'linked' for auto-detected relationships
  - Gracefully falls back to flat list if enrichment fails

### 🚀 Applied To
- **Search API** (`/api/search`) - All slash command searches now include relationships
- **Prompt API** (`/api/prompt`) - AI-powered natural language queries include relationships
- **Current sprint queries** - Sprint work items show hierarchical structure
- **All query types** - Benefits all search mechanisms across the application

### 🎯 Impact
- **Immediate visualization** - See relationships without extra clicks
- **Better context** - Understand how work items relate at a glance
- **Collapsible hierarchy** - Parent items with expand/collapse functionality
- **Performance optimized** - Parallel fetching keeps searches fast
- **Backward compatible** - Falls back to flat list when no relationships exist

### 💡 Example
When you query "get all marketing items" and the results include:
- Epic #5318 (Parent)
  - User Story #5319 (Child)
  - User Story #5320 (Child)
  - Task #5321 (Child)

The results will automatically display in a collapsible tree structure showing the parent-child relationships!

---

## [0.1.5] - 2025-01-05

### 🎨 Enhanced
- **Filter slidout tab visibility** - Made the filter button much more prominent and eye-catching
  - Changed color scheme from subtle gray to vibrant orange gradient
  - Added gentle pulse animation to draw attention (stops on hover)
  - Increased button size with larger padding and icons
  - Enhanced shadow effects with orange glow on hover
  - White filter icon with drop shadow for better contrast
  - Larger, more visible counter badge (white background with orange text)
  - Smooth transitions for all interactions

### 🔥 Visual Improvements
- **Orange branding** - Filter button now uses orange gradient (orange-600 → orange-500)
  - Border upgraded to orange-400 with increased width
  - Hover state transitions to lighter orange gradient
  - Shadow upgraded from shadow-lg to shadow-2xl
  - Added orange glow effect on hover (shadow-orange-500/50)
- **Animation polish** - Added `animate-pulse` class that disables on hover
- **Better accessibility** - Larger click target and more visible to all users

### 🎯 Impact
- **Improved discoverability** - Users will immediately notice the filter button
- **Enhanced user experience** - Clear visual hierarchy and smooth interactions
- **Better mobile support** - Larger button easier to tap on touch devices

---

## [0.1.4] - 2025-01-05

### ✨ Added
- **Hierarchical work item display** - Related items now display in a collapsible tree structure
  - Automatically detects parent/child relationships in work items
  - Collapsible sections with expand/collapse buttons (ChevronDown/ChevronRight icons)
  - Visual connection lines showing parent-child relationships
  - Relation type badges (Parent/Child/Related) for clear identification
  - Indented display (24px per level) for visual hierarchy
  - Falls back gracefully to flat list display when no hierarchical relationships exist

### 🚀 Enhanced
- **Card view improvements** - Intelligently switches between hierarchical and flat display
  - Checks work items for hierarchical relationships automatically
  - Maintains "show more/less" functionality for long lists
  - Preserves existing flat list behavior for non-hierarchical results
  - Grid view continues to use existing layout

### 🛠️ Technical Details
- Added `lib/hierarchy-utils.ts` - Utility functions for building and analyzing work item hierarchies
  - `buildHierarchy()` - Converts flat work item arrays to tree structures
  - `hasHierarchicalRelations()` - Detects parent/child relationships
  - `HierarchicalWorkItem` interface with `children`, `level`, `hasChildren` fields
- Added `components/HierarchicalWorkItemList.tsx` - New React component for tree display
  - Uses `useState` for expand/collapse state management
  - Recursive rendering for nested children
  - Supports maxInitialItems prop for pagination
- Modified `components/MessageList.tsx` - Conditional rendering logic
  - Checks for hierarchical relations before rendering
  - Seamless fallback to existing display for backward compatibility

### 🎯 Impact
- **Better visualization of complex work item relationships** - Users can now see how work items relate to each other
- **Improved navigation** - Collapse/expand functionality reduces clutter for large result sets
- **100% backward compatible** - No breaking changes, flat display preserved when no hierarchy exists

---

## [0.1.3] - 2025-01-05

### 📝 Updated
- **Documentation improvements** - Organized changelog with collapsible sections for easier reading
- **Version tracking** - Incremental version bump for deployment tracking

### 🎯 Status
- All sprint query fixes from v0.1.1 and v0.1.2 are live and working
- System now fetches sprints from all teams (16 teams, hundreds of sprints)
- Sprint queries work reliably for any team (Marketing, CX, Engineering, etc.)

---

## [0.1.2] - 2025-01-05

### 🔧 Fixed
- **CRITICAL: Multi-team sprint fetching** - Now fetches sprints from ALL teams, not just first team
  - Previous behavior: Only fetched sprints from first team ("Parks and Recreation")
  - New behavior: Fetches sprints from all 16 teams in parallel
  - Fixes "marketing sprint" queries that failed because Marketing Experience sprints weren't loaded
  - Deduplicates sprints by path (some teams share sprints)
  - Sorts by most recent first

### 🚀 Enhanced
- **Sprint context completeness** - AI now has access to sprints from all teams
  - Can correctly answer queries like "show me marketing sprint items"
  - Can find sprints for any team/area (CX, Marketing, Engineering, etc.)
  - Better sprint name matching across all teams

### 🛠️ Technical Details
- Modified `getSprints()` to fetch from all teams when no specific team requested
- Added `getSprintsForTeam()` helper method for per-team fetching
- Uses `Promise.allSettled()` for parallel fetching with error resilience
- Added `team` field to sprint objects for traceability

---

<details>
<summary><strong>Previous Releases</strong> (click to expand)</summary>

## [0.1.1] - 2025-01-05

### 🔧 Fixed
- **CRITICAL: Sprint query handling** - Fixed 400 errors when querying sprint items
  - Azure DevOps WIQL does not allow `CONTAINS` operator on `System.IterationPath` fields
  - Added intelligent WIQL validator that auto-fixes invalid queries before execution
  - Sprint queries now correctly use `UNDER` operator for hierarchical path matching
  - Validator matches sprint names and automatically uses correct paths

### ✨ Enhanced
- **AI prompt engineering** - Significantly improved natural language understanding
  - Better interpretation of casual queries (e.g., "what's broken?" → bugs)
  - Enhanced conversational responses with context and actionable insights
  - Improved error messages with specific guidance and suggestions
  - Added sprint context awareness (fetches available sprints to inform AI)

### 🚀 Added
- **Sprint query detection** - Automatically detects sprint-related queries
  - `isSprintQuery()` - Identifies queries about sprints/iterations
  - `buildSprintContext()` - Provides AI with actual sprint names and paths
  - `validateAndFixWiqlQuery()` - Safety net that auto-corrects invalid WIQL

### 📝 Documentation
- Added `AI_ENHANCEMENTS.md` - Complete guide to AI improvements
- Added `SPRINT_QUERY_FIX.md` - Technical details on sprint query fixes
- Added `MCP_MIGRATION_PLAN.md` - Future roadmap for MCP integration

### 🎯 Impact
- **Sprint queries now work reliably** - Users can ask about sprints naturally
- **Better user experience** - More helpful, context-aware responses
- **Fewer errors** - Automatic validation and correction of queries
- **100% backward compatible** - No breaking changes to existing features

### 🛠️ Technical Details
- Modified `lib/enhanced-ai-prompts.ts` - Added enhanced prompt templates
- Modified `app/api/prompt/route.ts` - Integrated sprint detection and validation
- TypeScript compilation ✅ passes
- All existing features preserved

---

## [0.1.0] - 2024-XX-XX

### Initial Release
- Natural language query interface for Azure DevOps
- Slash commands for direct filtering (`/created_by`, `/assigned_to`, etc.)
- AI-powered conversational answers
- Sprint velocity and analytics
- Chart visualization
- Global filters
- Authentication with email OTP
- Related items discovery
- AI actions (release notes, test cases, summaries)

</details>
