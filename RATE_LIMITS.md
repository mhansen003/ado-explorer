# OpenAI Rate Limit Management

This document explains how the application manages OpenAI API rate limits and your options for optimization.

## Current Strategy: Hybrid Model Approach

The application now uses a **smart hybrid model approach** to optimize both cost and rate limits:

### Model Selection

| Task Type | Default Model | Rate Limit (Tier 1) | Cost per 1M tokens |
|-----------|---------------|---------------------|-------------------|
| **Simple Tasks** | `gpt-4o-mini` | 200,000 TPM | $0.15 input / $0.60 output |
| WIQL query generation | ✓ gpt-4o-mini | | |
| Response type detection | ✓ gpt-4o-mini | | |
| Error explanations | ✓ gpt-4o-mini | | |
| Follow-up suggestions | ✓ gpt-4o-mini | | |
| **Complex Tasks** | `gpt-4o` | 30,000 TPM | $2.50 input / $10.00 output |
| Conversational answers | ✓ gpt-4o | | |

**Result:** By using gpt-4o-mini for 4 out of 5 API calls, you get:
- **6.7x higher rate limit** (200K vs 30K TPM) for most operations
- **60x lower cost** ($0.15 vs $2.50 per 1M input tokens)
- **Same quality** for simple classification and generation tasks

## Automatic Retry Logic

When rate limits are hit, the system automatically:

1. **Detects rate limit errors** - Recognizes OpenAI rate limit responses
2. **Extracts wait time** - Parses the exact wait time from error message (e.g., "2.312s")
3. **Applies exponential backoff** - Waits progressively longer:
   - Retry 1: Wait time × 1.0
   - Retry 2: Wait time × 1.5
   - Retry 3: Wait time × 2.25
4. **Retries up to 3 times** - Maximizes success rate without excessive delays
5. **Shows friendly error** - If all retries fail, displays user-friendly message

## Configuration Options

### Option 1: Use Default (Recommended)

**No configuration needed!** The hybrid approach is enabled by default.

- Simple tasks use `gpt-4o-mini` (fast, cheap, high rate limits)
- Complex tasks use `gpt-4o` (better reasoning for conversational answers)

### Option 2: Force GPT-4o for All Tasks

If you prefer to use `gpt-4o` for all API calls (e.g., for absolute best quality):

**In your `.env.local` file:**
```env
OPENAI_USE_MINI=false
```

**Warning:** This will:
- Reduce your effective rate limit from 200K to 30K TPM
- Increase costs by up to 60x for simple operations
- Not significantly improve quality for tasks like query generation

### Option 3: Increase OpenAI Rate Limits

Your rate limits automatically increase as you spend more on OpenAI:

| Tier | Spending Required | gpt-4o TPM | gpt-4o-mini TPM |
|------|------------------|-----------|----------------|
| **Tier 1** (Current) | $5+ | 30,000 | 200,000 |
| **Tier 2** | $50+ | 450,000 | 2,000,000 |
| **Tier 3** | $100+ | 600,000 | 2,000,000 |
| **Tier 4** | $250+ | 800,000 | 4,000,000 |
| **Tier 5** | $1,000+ | 2,000,000 | 10,000,000 |

**To check your current tier:**
1. Visit https://platform.openai.com/settings/organization/limits
2. View your "Usage tier" and current rate limits

**To increase tier:**
- Use the API more (spending automatically moves you up tiers)
- No manual approval needed - happens automatically

## Monitoring Usage

### Check Rate Limit Status

The application logs rate limit information:

```bash
# In your deployment logs, look for:
[OpenAI] Rate limit hit on attempt 1/3: Please try again in 2.312s
[OpenAI] Waiting 2312ms before retry 2/3
```

### View OpenAI Dashboard

Monitor your usage in real-time:
- **Usage Dashboard:** https://platform.openai.com/usage
- **Rate Limits:** https://platform.openai.com/settings/organization/limits

### Vercel Deployment Logs

To see rate limit handling in production:

```bash
# View recent logs
vercel logs

# Follow logs in real-time
vercel logs --follow
```

## Cost Estimates

### Current Hybrid Approach

Assuming 1,000 queries per day:

| Operation | Model | Calls/Query | Tokens | Daily Cost |
|-----------|-------|-------------|--------|-----------|
| WIQL generation | gpt-4o-mini | 1 | ~500 | $0.075 |
| Type detection | gpt-4o-mini | 1 | ~100 | $0.015 |
| Suggestions | gpt-4o-mini | 1 | ~400 | $0.060 |
| Error handling | gpt-4o-mini | 0.1 | ~300 | $0.005 |
| Conversational answer | gpt-4o | 0.5 | ~1,500 | $1.875 |
| **Total Daily** | - | - | - | **~$2.03** |
| **Total Monthly** | - | - | - | **~$60.90** |

### All GPT-4o Approach

Same workload with `OPENAI_USE_MINI=false`:

| **Total Daily** | - | - | - | **~$7.50** |
| **Total Monthly** | - | - | - | **~$225.00** |

**Savings with hybrid approach: $164.10/month (73% cost reduction)**

## Troubleshooting

### Still Hitting Rate Limits?

If you're still encountering rate limits frequently:

1. **Check your tier** - You may need to reach Tier 2 ($50 spent)
2. **Reduce concurrent users** - Multiple simultaneous queries consume more TPM
3. **Add caching** - Cache common queries to reduce API calls
4. **Batch operations** - Group multiple queries together when possible

### Rate Limit Error Not Retrying?

If errors aren't automatically retrying:

1. **Check deployment** - Ensure latest code is deployed: `git pull && npm run build`
2. **Verify logs** - Look for `[OpenAI] Waiting Xms before retry` messages
3. **Update dependencies** - Ensure you're on the latest version

### Want to Disable Retries?

Not recommended, but if needed:

Edit `lib/openai-utils.ts` and change:
```typescript
export async function callOpenAIWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 1  // Change from 3 to 1 (no retries)
)
```

## Best Practices

### ✅ Recommended

- **Use default hybrid approach** - Optimal balance of cost, speed, and rate limits
- **Monitor usage trends** - Watch for patterns in rate limit hits
- **Plan for growth** - Budget for Tier 2 upgrade if scaling up
- **Enable retries** - Let the automatic retry logic handle temporary limits

### ❌ Not Recommended

- **Disabling gpt-4o-mini** - Significantly increases costs and rate limit pressure
- **Disabling retry logic** - Creates poor user experience during peak usage
- **Ignoring rate limit logs** - Missing opportunities to optimize
- **Setting max_tokens too high** - Wastes tokens and increases costs

## Additional Resources

- **OpenAI Rate Limits Guide:** https://platform.openai.com/docs/guides/rate-limits
- **Usage Tiers Documentation:** https://platform.openai.com/docs/guides/rate-limits/usage-tiers
- **Model Pricing:** https://openai.com/api/pricing/
- **Best Practices:** https://platform.openai.com/docs/guides/rate-limits/optimize-usage

## Questions?

If you have questions about rate limit management or need help optimizing:

1. Check the OpenAI dashboard for your current usage and tier
2. Review deployment logs for rate limit patterns
3. Consider upgrading to Tier 2 if consistently hitting limits with the hybrid approach
