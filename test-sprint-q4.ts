/**
 * Test specific sprint path that's failing
 */

import { AIOrchestrator } from './lib/ai-orchestrator/orchestrator';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testSprintQ4() {
  console.log('\n🧪 Testing Sprint Q4 Path Issue');
  console.log('=' .repeat(60));

  const orchestrator = new AIOrchestrator();

  const query = '/sprint AIO Initiatives\\AIO Initiatives\\2025 Q4';
  console.log(`\n📝 Query: "${query}"`);

  try {
    const startTime = Date.now();
    const result = await orchestrator.process({
      query,
      userId: 'test-user',
      conversationId: 'test-conv-' + Date.now(),
    });

    const duration = Date.now() - startTime;

    console.log('\n✅ Query succeeded in', duration, 'ms');
    console.log('\n📊 Response:');
    console.log('- Success:', result.response.success);
    console.log('- Summary:', result.response.summary);
    console.log('- Work Items:', result.response.rawData?.length || 0);
    console.log('- Error:', result.response.error);

    console.log('\n⏱️ Metrics:');
    result.metrics.forEach(m => {
      console.log(`- ${m.phase}: ${m.duration}ms (${m.success ? '✓' : '✗'})`);
      if (m.error) console.log(`  Error: ${m.error}`);
    });

    if (result.response.rawData && result.response.rawData.length > 0) {
      console.log('\n📋 Sample Items:');
      result.response.rawData.slice(0, 3).forEach((item: any) => {
        console.log(`- #${item.id}: ${item.title} (${item.state})`);
      });
    }
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testSprintQ4().then(() => {
  console.log('\n✅ Test complete\n');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
