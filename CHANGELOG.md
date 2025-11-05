# Changelog

All notable changes to ADO Explorer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
