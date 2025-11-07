/**
 * Comprehensive Test Suite for AI Orchestrator
 *
 * Tests 30+ queries and validates:
 * - WIQL query correctness
 * - Intent classification accuracy
 * - Response quality
 * - Common patterns and issues
 */

import { AIOrchestrator } from './lib/ai-orchestrator';
import { OrchestratorInput } from './lib/types/ai-types';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

interface TestCase {
  query: string;
  category: string;
  expectedIntent: {
    type?: string;
    scope?: string;
    hasUser?: boolean;
    hasProject?: boolean;
    hasSprint?: boolean;
  };
  expectedQuery?: {
    shouldContain?: string[];
    shouldNotContain?: string[];
    field?: string; // Expected ADO field to query
  };
}

const TEST_CASES: TestCase[] = [
  // Category: CreatedBy queries
  {
    query: "all tickets opened by ericka",
    category: "CreatedBy",
    expectedIntent: { type: "COMMAND", scope: "USER", hasUser: true },
    expectedQuery: { field: "System.CreatedBy", shouldContain: ["CreatedBy", "ericka"] }
  },
  {
    query: "show me items created by mark",
    category: "CreatedBy",
    expectedIntent: { type: "COMMAND", scope: "USER", hasUser: true },
    expectedQuery: { field: "System.CreatedBy", shouldContain: ["CreatedBy", "mark"] }
  },
  {
    query: "what did john submit",
    category: "CreatedBy",
    expectedIntent: { scope: "USER", hasUser: true },
    expectedQuery: { field: "System.CreatedBy", shouldContain: ["CreatedBy"] }
  },

  // Category: AssignedTo queries
  {
    query: "tickets assigned to mark",
    category: "AssignedTo",
    expectedIntent: { type: "COMMAND", scope: "USER", hasUser: true },
    expectedQuery: { field: "System.AssignedTo", shouldContain: ["AssignedTo", "mark"] }
  },
  {
    query: "show me sarah's work items",
    category: "AssignedTo",
    expectedIntent: { scope: "USER", hasUser: true },
    expectedQuery: { field: "System.AssignedTo", shouldContain: ["AssignedTo"] }
  },
  {
    query: "what is ericka working on",
    category: "AssignedTo",
    expectedIntent: { scope: "USER", hasUser: true },
    expectedQuery: { field: "System.AssignedTo", shouldContain: ["AssignedTo"] }
  },

  // Category: Project queries
  {
    query: "show items from project genesis",
    category: "Project",
    expectedIntent: { scope: "PROJECT", hasProject: true },
    expectedQuery: { shouldContain: ["TeamProject", "Genesis"] }
  },
  {
    query: "list all work items in Next Gen LOS",
    category: "Project",
    expectedIntent: { scope: "PROJECT", hasProject: true },
    expectedQuery: { shouldContain: ["TeamProject"] }
  },

  // Category: Sprint queries
  {
    query: "show sprint 48 items",
    category: "Sprint",
    expectedIntent: { scope: "SPRINT", hasSprint: true },
    expectedQuery: { shouldContain: ["IterationPath", "Sprint 48"] }
  },
  {
    query: "what's in sprint 49",
    category: "Sprint",
    expectedIntent: { scope: "SPRINT", hasSprint: true },
    expectedQuery: { shouldContain: ["IterationPath", "49"] }
  },
  {
    query: "current sprint status",
    category: "Sprint",
    expectedIntent: { scope: "SPRINT", hasSprint: true },
    expectedQuery: { shouldContain: ["IterationPath"] }
  },

  // Category: Project + Sprint combination
  {
    query: "display items from project genesis that have the iteration sprint 49",
    category: "Project+Sprint",
    expectedIntent: { scope: "PROJECT", hasProject: true, hasSprint: true },
    expectedQuery: { shouldContain: ["TeamProject", "Genesis", "IterationPath", "Sprint 49"] }
  },
  {
    query: "show me Next Gen LOS sprint 48",
    category: "Project+Sprint",
    expectedIntent: { hasProject: true, hasSprint: true },
    expectedQuery: { shouldContain: ["IterationPath", "48"] }
  },

  // Category: State filters
  {
    query: "show me all active bugs",
    category: "State+Type",
    expectedIntent: { type: "COMMAND" },
    expectedQuery: { shouldContain: ["State", "Active", "Bug"] }
  },
  {
    query: "list closed tasks",
    category: "State+Type",
    expectedIntent: { type: "COMMAND" },
    expectedQuery: { shouldContain: ["State", "Closed", "Task"] }
  },
  {
    query: "what are the new user stories",
    category: "State+Type",
    expectedIntent: {},
    expectedQuery: { shouldContain: ["User Story"] }
  },

  // Category: Priority queries
  {
    query: "what are the P1 items",
    category: "Priority",
    expectedIntent: {},
    expectedQuery: { shouldContain: ["Priority", "1"] }
  },
  {
    query: "show high priority bugs",
    category: "Priority",
    expectedIntent: {},
    expectedQuery: { shouldContain: ["Priority", "Bug"] }
  },

  // Category: ID lookup
  {
    query: "show ticket #12345",
    category: "ID Lookup",
    expectedIntent: { scope: "ISSUE" },
    expectedQuery: { shouldContain: ["System.Id", "12345"] }
  },
  {
    query: "86230",
    category: "ID Lookup",
    expectedIntent: { scope: "ISSUE" },
    expectedQuery: { shouldContain: ["System.Id", "86230"] }
  },

  // Category: Collection queries (metadata)
  {
    query: "list all projects",
    category: "Collections",
    expectedIntent: { type: "COMMAND" },
    expectedQuery: {} // These don't generate WIQL
  },
  {
    query: "show me all users",
    category: "Collections",
    expectedIntent: { type: "COMMAND" },
    expectedQuery: {}
  },
  {
    query: "what sprints are available",
    category: "Collections",
    expectedIntent: { type: "COMMAND" },
    expectedQuery: {}
  },
  {
    query: "list all teams",
    category: "Collections",
    expectedIntent: { type: "COMMAND" },
    expectedQuery: {}
  },

  // Category: Complex analytical queries
  {
    query: "how many bugs are in sprint 48",
    category: "Analysis",
    expectedIntent: { type: "ANALYSIS", scope: "SPRINT" },
    expectedQuery: { shouldContain: ["IterationPath", "Bug"] }
  },
  {
    query: "show me blocked items",
    category: "Analysis",
    expectedIntent: {},
    expectedQuery: { shouldContain: ["State", "Blocked"] }
  },
  {
    query: "what's overdue",
    category: "Analysis",
    expectedIntent: {},
    expectedQuery: {}
  },

  // Category: Natural language variations
  {
    query: "find everything ericka made",
    category: "Natural",
    expectedIntent: { hasUser: true },
    expectedQuery: { shouldContain: ["CreatedBy"] }
  },
  {
    query: "get mark's assignments",
    category: "Natural",
    expectedIntent: { hasUser: true },
    expectedQuery: { shouldContain: ["AssignedTo"] }
  },
  {
    query: "pull up sarah's tickets",
    category: "Natural",
    expectedIntent: { hasUser: true },
    expectedQuery: { shouldContain: ["AssignedTo"] }
  },
];

interface TestResult {
  query: string;
  category: string;
  success: boolean;
  passed: number;
  failed: number;
  issues: string[];
  intent: any;
  generatedQuery: string;
  resultCount: number;
  processingTime: number;
}

async function runTest(testCase: TestCase): Promise<TestResult> {
  const orchestrator = new AIOrchestrator();
  const startTime = Date.now();

  const input: OrchestratorInput = {
    query: testCase.query,
    userId: 'test@example.com',
    options: { skipCache: true, verbose: true },
  };

  const result: TestResult = {
    query: testCase.query,
    category: testCase.category,
    success: false,
    passed: 0,
    failed: 0,
    issues: [],
    intent: null,
    generatedQuery: '',
    resultCount: 0,
    processingTime: 0,
  };

  try {
    const response = await orchestrator.process(input);
    result.processingTime = Date.now() - startTime;
    result.resultCount = response.response.rawData?.length || 0;
    result.success = response.response.success;

    // Extract intent
    const intentMetric = response.metrics?.find(m => m.phase === 'Intent Analysis');
    if (intentMetric?.output) {
      result.intent = {
        type: intentMetric.output.type,
        scope: intentMetric.output.scope,
        userIdentifier: intentMetric.output.userIdentifier,
        projectIdentifier: intentMetric.output.projectIdentifier,
        sprintIdentifier: intentMetric.output.sprintIdentifier,
      };

      // Validate intent expectations
      if (testCase.expectedIntent.type && result.intent.type !== testCase.expectedIntent.type) {
        result.issues.push(`Expected intent type '${testCase.expectedIntent.type}', got '${result.intent.type}'`);
        result.failed++;
      } else {
        result.passed++;
      }

      if (testCase.expectedIntent.scope && result.intent.scope !== testCase.expectedIntent.scope) {
        result.issues.push(`Expected scope '${testCase.expectedIntent.scope}', got '${result.intent.scope}'`);
        result.failed++;
      } else if (testCase.expectedIntent.scope) {
        result.passed++;
      }

      if (testCase.expectedIntent.hasUser && !result.intent.userIdentifier) {
        result.issues.push('Expected userIdentifier but none found');
        result.failed++;
      } else if (testCase.expectedIntent.hasUser) {
        result.passed++;
      }

      if (testCase.expectedIntent.hasProject && !result.intent.projectIdentifier) {
        result.issues.push('Expected projectIdentifier but none found');
        result.failed++;
      } else if (testCase.expectedIntent.hasProject) {
        result.passed++;
      }

      if (testCase.expectedIntent.hasSprint && !result.intent.sprintIdentifier) {
        result.issues.push('Expected sprintIdentifier but none found');
        result.failed++;
      } else if (testCase.expectedIntent.hasSprint) {
        result.passed++;
      }
    }

    // Extract generated query
    const queryMetric = response.metrics?.find(m => m.phase === 'Query Planning');
    if (queryMetric?.output?.queries?.length > 0) {
      result.generatedQuery = queryMetric.output.queries[0].query;

      // Validate query expectations
      if (testCase.expectedQuery?.shouldContain) {
        for (const term of testCase.expectedQuery.shouldContain) {
          if (result.generatedQuery.includes(term)) {
            result.passed++;
          } else {
            result.issues.push(`Query missing expected term: '${term}'`);
            result.failed++;
          }
        }
      }

      if (testCase.expectedQuery?.shouldNotContain) {
        for (const term of testCase.expectedQuery.shouldNotContain) {
          if (!result.generatedQuery.includes(term)) {
            result.passed++;
          } else {
            result.issues.push(`Query contains unexpected term: '${term}'`);
            result.failed++;
          }
        }
      }

      if (testCase.expectedQuery?.field) {
        if (result.generatedQuery.includes(testCase.expectedQuery.field)) {
          result.passed++;
        } else {
          result.issues.push(`Query should use field: '${testCase.expectedQuery.field}'`);
          result.failed++;
        }
      }
    }

  } catch (error: any) {
    result.success = false;
    result.issues.push(`Error: ${error.message}`);
    result.failed++;
  }

  return result;
}

async function main() {
  console.log('🧪 COMPREHENSIVE AI ORCHESTRATOR TEST SUITE');
  console.log('='.repeat(80));
  console.log(`Testing ${TEST_CASES.length} queries...`);
  console.log('');

  const results: TestResult[] = [];
  const categoryStats: Record<string, { passed: number; failed: number; total: number }> = {};

  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    process.stdout.write(`[${i + 1}/${TEST_CASES.length}] Testing: "${testCase.query.substring(0, 50)}..." `);

    const result = await runTest(testCase);
    results.push(result);

    // Update category stats
    if (!categoryStats[testCase.category]) {
      categoryStats[testCase.category] = { passed: 0, failed: 0, total: 0 };
    }
    categoryStats[testCase.category].passed += result.passed;
    categoryStats[testCase.category].failed += result.failed;
    categoryStats[testCase.category].total++;

    const status = result.failed === 0 ? '✅' : '⚠️';
    console.log(`${status} (${result.passed}/${result.passed + result.failed} checks passed)`);

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // SUMMARY REPORT
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalTests = totalPassed + totalFailed;

  console.log(`\n✅ Passed: ${totalPassed}/${totalTests} (${Math.round((totalPassed / totalTests) * 100)}%)`);
  console.log(`❌ Failed: ${totalFailed}/${totalTests} (${Math.round((totalFailed / totalTests) * 100)}%)`);

  // Category breakdown
  console.log('\n📂 Results by Category:');
  Object.entries(categoryStats).sort((a, b) => b[1].total - a[1].total).forEach(([category, stats]) => {
    const passRate = stats.passed / (stats.passed + stats.failed) * 100;
    const status = passRate >= 80 ? '✅' : passRate >= 60 ? '⚠️' : '❌';
    console.log(`  ${status} ${category.padEnd(20)} ${stats.passed}/${stats.passed + stats.failed} checks (${Math.round(passRate)}% pass rate)`);
  });

  // Show failures
  const failures = results.filter(r => r.failed > 0);
  if (failures.length > 0) {
    console.log('\n⚠️  Failed Tests:');
    failures.forEach(r => {
      console.log(`\n  Query: "${r.query}"`);
      console.log(`  Category: ${r.category}`);
      r.issues.forEach(issue => console.log(`    ❌ ${issue}`));
      if (r.generatedQuery) {
        console.log(`    Generated: ${r.generatedQuery.substring(0, 100)}...`);
      }
    });
  }

  // Performance stats
  const avgTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
  const maxTime = Math.max(...results.map(r => r.processingTime));
  const minTime = Math.min(...results.map(r => r.processingTime));

  console.log('\n⏱️  Performance:');
  console.log(`  Average: ${Math.round(avgTime)}ms`);
  console.log(`  Min: ${minTime}ms`);
  console.log(`  Max: ${maxTime}ms`);

  // Common patterns found
  console.log('\n🔍 Common Patterns:');
  const createdByQueries = results.filter(r => r.generatedQuery.includes('CreatedBy'));
  const assignedToQueries = results.filter(r => r.generatedQuery.includes('AssignedTo'));
  const projectQueries = results.filter(r => r.generatedQuery.includes('TeamProject'));

  console.log(`  CreatedBy queries: ${createdByQueries.length}`);
  console.log(`  AssignedTo queries: ${assignedToQueries.length}`);
  console.log(`  Project-specific queries: ${projectQueries.length}`);

  console.log('\n' + '='.repeat(80));
  console.log(totalFailed === 0 ? '🎉 ALL TESTS PASSED!' : `⚠️  ${failures.length} tests need attention`);
  console.log('='.repeat(80));
}

main().catch(console.error);
