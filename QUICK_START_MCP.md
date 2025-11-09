# Quick Start: Using MCP Integration

## 🚀 Get Started in 3 Steps

### **Step 1: Get Anthropic API Key** 🔑

1. Go to https://console.anthropic.com/settings/keys
2. Click "Create Key"
3. Copy your key (starts with `sk-ant-...`)

### **Step 2: Update .env.local** ⚙️

Replace the placeholder:
```env
# Before
ANTHROPIC_API_KEY="your-anthropic-api-key-here"

# After
ANTHROPIC_API_KEY="sk-ant-api03-YOUR-ACTUAL-KEY-HERE"
```

### **Step 3: Test It!** 🧪

Create `test-hybrid-service.ts`:
```typescript
import { ADOServiceHybrid } from './lib/ado-service-hybrid';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function test() {
  const service = new ADOServiceHybrid(
    process.env.NEXT_PUBLIC_ADO_ORGANIZATION!,
    process.env.ADO_PAT!,
    process.env.NEXT_PUBLIC_ADO_PROJECT,
    { useMCP: true }
  );

  console.log('🔍 Service Status:', service.getServiceStatus());

  // Test 1: Get sprints (MCP provides timeFrame!)
  const sprints = await service.getSprints();
  console.log('\n📅 Sprints:');
  sprints.forEach(s => console.log(`  - ${s.name} [${s.timeFrame || 'unknown'}]`));

  // Test 2: Get current sprint items (no WIQL errors!)
  try {
    const currentItems = await service.getCurrentSprintWorkItems();
    console.log(`\n✅ Current Sprint Items: ${currentItems.length}`);
  } catch (error) {
    console.log('\n⚠️  Current Sprint Items: Need team ID');
  }

  // Test 3: Full-text search (new capability!)
  const searchResults = await service.searchFullText('authentication', undefined, 5);
  console.log(`\n🔍 Full-text search results: ${searchResults.length}`);
}

test();
```

Run it:
```bash
npx tsx test-hybrid-service.ts
```

---

## 📊 Before vs After

### **Sprint Queries**

#### Before (OpenAI + WIQL):
```
User: "show me current sprint items"
  ↓
OpenAI generates WIQL:
  "SELECT [System.Id] FROM WorkItems
   WHERE [System.IterationPath] UNDER 'Next Gen LOS\\Sprint 15'"
  ↓
❌ Error: TF51011 - Iteration path doesn't exist
❌ AI guessed wrong path
❌ User sees error, tries again
```

#### After (Anthropic + MCP):
```
User: "show me current sprint items"
  ↓
Claude uses MCP tool: work_list_team_iterations(timeframe="current")
  ↓
Claude uses MCP tool: wit_get_work_items_for_iteration(iterationId=...)
  ↓
✅ Returns work items
✅ No WIQL, no paths, no errors!
```

---

## 🎯 What Changed

| Feature | Before | After |
|---------|--------|-------|
| **Sprint Queries** | ❌ Error-prone WIQL paths | ✅ Direct MCP calls |
| **Current Sprint Detection** | ⚠️ Manual date comparison | ✅ MCP timeFrame field |
| **Full-Text Search** | ❌ Not available | ✅ Relevance-ranked |
| **API Errors** | ❌ Frequent 400 errors | ✅ Rare (auto-fallback) |
| **Token Usage** | 🟡 High (sprint lists in prompts) | 🟢 Lower (on-demand) |

---

## 💡 Usage Patterns

### **Pattern 1: Drop-in Replacement**
```typescript
// Old
import { ADOService } from '@/lib/ado-api';
const service = new ADOService(org, pat, project);

// New (with MCP benefits!)
import { ADOServiceHybrid } from '@/lib/ado-service-hybrid';
const service = new ADOServiceHybrid(org, pat, project);

// All existing methods still work, but some are better!
```

### **Pattern 2: Conditional MCP**
```typescript
const useMCP = process.env.ANTHROPIC_API_KEY &&
               process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here';

const service = useMCP
  ? new ADOServiceHybrid(org, pat, project, { useMCP: true })
  : new ADOService(org, pat, project);
```

### **Pattern 3: Feature Flag**
```typescript
// .env.local
ENABLE_MCP_FEATURES=true

// Code
const service = process.env.ENABLE_MCP_FEATURES === 'true'
  ? new ADOServiceHybrid(org, pat, project)
  : new ADOService(org, pat, project);
```

---

## 🔍 Debugging

### **Check MCP Status**
```typescript
const status = service.getServiceStatus();
console.log(status);
// { useMCP: true, mcpAvailable: true, restAvailable: true }
```

### **Force REST Fallback**
```typescript
const service = new ADOServiceHybrid(org, pat, project, { useMCP: false });
// Or just don't set ANTHROPIC_API_KEY
```

### **Monitor MCP Usage**
Watch console logs:
```
[Hybrid Service] ✅ MCP service initialized
[MCP Service] Getting sprints for project: Next Gen LOS
[MCP Service] Found 15 sprints
```

If MCP fails:
```
[Hybrid Service] ⚠️ MCP getSprints failed, falling back to REST
```

---

## 📈 Next Steps

1. **Update Routes** - Replace ADOService with ADOServiceHybrid in:
   - `/api/sprints` ⭐ (Biggest benefit)
   - `/api/projects`
   - `/api/boards`

2. **Update AI Orchestrator** - Replace OpenAI with Anthropic+MCP in:
   - `lib/ai-orchestrator/query-planner.ts`
   - `lib/ai-orchestrator/intent-analyzer.ts`

3. **Add Monitoring** - Track:
   - MCP success rate
   - Fallback frequency
   - Response times
   - Anthropic API costs

---

## ❓ FAQ

**Q: Do I need to change existing code?**
A: No! ADOServiceHybrid is a drop-in replacement. Change imports only.

**Q: What if I don't have Anthropic API key?**
A: Service automatically falls back to REST API only.

**Q: Will my WIQL queries still work?**
A: Yes! WIQL queries use REST API (MCP doesn't support custom WIQL).

**Q: Is this production-ready?**
A: Yes, with caveats:
- Test thoroughly first
- Monitor Anthropic API costs
- Have fallback strategy

**Q: What's the cost?**
A: ~$0.001-0.003 per MCP tool call. Sprint query = ~$0.002.

---

## 🎉 You're All Set!

Files to review:
- `MCP_IMPLEMENTATION_COMPLETE.md` - Full technical details
- `MCP_TOOLS_MAPPING.md` - All 80+ MCP tools documented
- `MCP_INTEGRATION_ANALYSIS.md` - System architecture

Go get that Anthropic API key and enjoy error-free sprint queries! 🚀

