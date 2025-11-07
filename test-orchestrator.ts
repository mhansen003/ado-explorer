/**
 * Test AI Orchestrator
 *
 * Comprehensive test suite for the AI orchestrator with real ADO queries.
 */

import { AIOrchestrator } from './lib/ai-orchestrator';
import { OrchestratorInput } from './lib/types/ai-types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80) + '\n');
}

function logTest(query: string) {
  log(`\n📝 Query: "${query}"`, 'cyan');
  log('─'.repeat(80), 'reset');
}

function logResult(result: any) {
  log(`✅ Success: ${result.response.success}`, result.response.success ? 'green' : 'red');
  log(`📊 Summary: ${result.response.summary}`, 'reset');
  log(`📈 Work Items: ${result.response.rawData.length}`, 'yellow');
  log(`⚡ Processing Time: ${result.response.metadata.processingTime}ms`, 'yellow');
  log(`💾 Cache Hit: ${result.response.metadata.cacheHit}`, 'yellow');
  log(`🎯 Confidence: ${(result.response.metadata.confidence * 100).toFixed(1)}%`, 'yellow');
  log(`🔍 Queries Executed: ${result.response.metadata.queriesExecuted}`, 'yellow');

  if (result.response.analysis) {
    log(`\n🧠 Analysis:`, 'blue');
    log(`   Title: ${result.response.analysis.title}`, 'reset');
    log(`   Metrics: ${result.response.analysis.metrics.length}`, 'reset');
    log(`   Insights: ${result.response.analysis.insights.length}`, 'reset');
  }

  if (result.response.visualizations) {
    log(`\n📊 Visualizations: ${result.response.visualizations.length}`, 'blue');
    result.response.visualizations.forEach((viz: any) => {
      log(`   - ${viz.type}: ${viz.title}`, 'reset');
    });
  }

  if (result.response.suggestions) {
    log(`\n💡 Suggestions:`, 'blue');
    result.response.suggestions.forEach((suggestion: string) => {
      log(`   - ${suggestion}`, 'reset');
    });
  }

  if (result.response.error) {
    log(`\n❌ Error: ${result.response.error}`, 'red');
  }
}

async function runTest(orchestrator: AIOrchestrator, query: string, userId: string, conversationId?: string) {
  logTest(query);

  try {
    const input: OrchestratorInput = {
      query,
      userId,
      conversationId,
      options: {
        skipCache: false,
        verbose: true,
      },
    };

    const result = await orchestrator.process(input);
    logResult(result);

    // Return conversation ID for chaining
    return result.conversationContext.conversationId;
  } catch (error) {
    log(`\n❌ Test Failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    console.error(error);
    return conversationId;
  }
}

async function main() {
  log('🚀 Starting AI Orchestrator Test Suite', 'bright');
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'reset');
  log(`ADO Org: ${process.env.NEXT_PUBLIC_ADO_ORGANIZATION}`, 'reset');
  log(`ADO Project: ${process.env.NEXT_PUBLIC_ADO_PROJECT}`, 'reset');

  const orchestrator = new AIOrchestrator();
  const userId = 'test-user@example.com';
  let conversationId: string | undefined;

  // =========================================================================
  // TEST SUITE 1: General Questions (No ADO Data)
  // =========================================================================
  logSection('TEST SUITE 1: General Questions (No ADO Data)');

  await runTest(orchestrator, 'What is a sprint?', userId);
  await runTest(orchestrator, 'How do I use Azure DevOps?', userId);

  // =========================================================================
  // TEST SUITE 2: Simple Commands
  // =========================================================================
  logSection('TEST SUITE 2: Simple Commands');

  conversationId = await runTest(orchestrator, 'show me all items for the sandbox project', userId);
  await runTest(orchestrator, 'show me tickets opened by ericka', userId, conversationId);
  await runTest(orchestrator, 'show me active bugs', userId, conversationId);

  // =========================================================================
  // TEST SUITE 3: Sprint Queries
  // =========================================================================
  logSection('TEST SUITE 3: Sprint Queries');

  await runTest(orchestrator, 'show me the last marketing sprint', userId, conversationId);
  await runTest(orchestrator, 'what items are in the current sprint?', userId, conversationId);
  await runTest(orchestrator, 'show me blocked items in the current sprint', userId, conversationId);

  // =========================================================================
  // TEST SUITE 4: Counts and Analysis
  // =========================================================================
  logSection('TEST SUITE 4: Counts and Analysis');

  await runTest(orchestrator, 'how many marketing tickets are open', userId, conversationId);
  await runTest(orchestrator, 'how many bugs are assigned to me?', userId, conversationId);
  await runTest(orchestrator, 'what is the count of high priority items?', userId, conversationId);

  // =========================================================================
  // TEST SUITE 5: Analytical Queries
  // =========================================================================
  logSection('TEST SUITE 5: Analytical Queries');

  await runTest(orchestrator, 'why is the current sprint behind schedule?', userId, conversationId);
  await runTest(orchestrator, 'analyze the velocity of the last 3 sprints', userId, conversationId);
  await runTest(orchestrator, 'what are the main blockers in our project?', userId, conversationId);

  // =========================================================================
  // TEST SUITE 6: Project Summary
  // =========================================================================
  logSection('TEST SUITE 6: Project Summary');

  await runTest(orchestrator, 'summarize the entire project', userId, conversationId);
  await runTest(orchestrator, 'give me an overview of all work items', userId, conversationId);

  // =========================================================================
  // TEST SUITE 7: Slash Commands (Fast-Path)
  // =========================================================================
  logSection('TEST SUITE 7: Slash Commands (Fast-Path)');

  await runTest(orchestrator, '/state Active', userId, conversationId);
  await runTest(orchestrator, '/type Bug', userId, conversationId);
  await runTest(orchestrator, '/created_by ericka', userId, conversationId);

  // =========================================================================
  // TEST SUITE 8: Complex Multi-Step Queries
  // =========================================================================
  logSection('TEST SUITE 8: Complex Multi-Step Queries');

  await runTest(orchestrator, 'compare the velocity between the last two sprints', userId, conversationId);
  await runTest(orchestrator, 'which team member has the most open bugs?', userId, conversationId);
  await runTest(orchestrator, 'show me unassigned high priority items created this month', userId, conversationId);

  // =========================================================================
  // TEST SUITE 9: Conversational Follow-ups
  // =========================================================================
  logSection('TEST SUITE 9: Conversational Follow-ups');

  conversationId = await runTest(orchestrator, 'show me items assigned to John', userId);
  await runTest(orchestrator, 'how many are high priority?', userId, conversationId);
  await runTest(orchestrator, 'show me just the bugs', userId, conversationId);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  logSection('🎉 Test Suite Complete!');

  // Get context stats
  if (conversationId) {
    const stats = await orchestrator.getContextStats(conversationId);
    if (stats) {
      log('📊 Conversation Statistics:', 'blue');
      log(`   Total Turns: ${stats.totalTurns}`, 'reset');
      log(`   Total Work Items: ${stats.totalWorkItems}`, 'reset');
      log(`   Avg Response Time: ${stats.avgResponseTime.toFixed(2)}ms`, 'reset');
      log(`   Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`, 'reset');
    }
  }

  log('\n✅ All tests completed successfully!', 'green');
}

// Run tests
main().catch((error) => {
  log(`\n💥 Fatal Error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
