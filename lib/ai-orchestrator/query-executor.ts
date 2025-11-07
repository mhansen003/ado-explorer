/**
 * Query Executor
 *
 * Phase 4 of the AI Orchestrator pipeline.
 * Executes queries against Azure DevOps with Redis caching (5-minute TTL).
 */

import { QueryPlan, PlannedQuery, QueryResults, QueryResult } from '../types/ai-types';
import { WorkItem, GlobalFilters } from '@/types';
import { ADOService } from '../ado-api';
import { CacheService } from '../redis/cacheService';

const CACHE_TTL = 300; // 5 minutes in seconds

export class QueryExecutor {
  private cache: CacheService;

  constructor() {
    this.cache = new CacheService();
  }

  /**
   * Get ADO service instance (creates new instance per request with current env vars)
   */
  private getADOService(): ADOService {
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const pat = process.env.ADO_PAT;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;

    if (!organization || !pat) {
      throw new Error('ADO credentials not configured');
    }

    return new ADOService(organization, pat, project);
  }

  /**
   * Execute the planned queries with caching
   */
  async execute(
    plan: QueryPlan,
    filters?: GlobalFilters,
    options?: {
      skipCache?: boolean;
      cacheKey?: string;
    }
  ): Promise<QueryResults> {
    const startTime = Date.now();
    const results: QueryResult[] = [];
    let workItems: WorkItem[] = [];
    let cacheHits = 0;

    try {
      // Sort queries by priority
      const sortedQueries = [...plan.queries].sort((a, b) => a.priority - b.priority);

      // Execute queries sequentially or in parallel based on dependencies
      for (const query of sortedQueries) {
        // Check if this query depends on others
        const dependencies = query.dependsOn || [];
        const dependenciesMet = dependencies.every((depId) =>
          results.some((r) => r.queryId === depId && r.success)
        );

        if (!dependenciesMet && !query.optional) {
          results.push({
            queryId: query.id,
            success: false,
            data: null,
            error: 'Dependencies not met',
            duration: 0,
            cached: false,
          });
          continue;
        }

        // Execute the query
        const queryResult = await this.executeQuery(
          query,
          filters,
          options?.skipCache,
          options?.cacheKey
        );

        results.push(queryResult);

        if (queryResult.cached) {
          cacheHits++;
        }

        // Collect work items from WIQL queries
        if (query.type === 'WIQL' && queryResult.success && queryResult.data) {
          workItems = [...workItems, ...(queryResult.data.workItems || [])];
        }
      }

      // Calculate metadata
      const metadata = {
        totalQueries: results.length,
        successfulQueries: results.filter((r) => r.success).length,
        failedQueries: results.filter((r) => !r.success).length,
        totalDuration: Date.now() - startTime,
        cacheHits,
      };

      return {
        results,
        workItems,
        metadata,
      };
    } catch (error) {
      console.error('Error executing queries:', error);

      return {
        results,
        workItems: [],
        metadata: {
          totalQueries: results.length,
          successfulQueries: results.filter((r) => r.success).length,
          failedQueries: results.filter((r) => !r.success).length,
          totalDuration: Date.now() - startTime,
          cacheHits,
        },
      };
    }
  }

  /**
   * Execute a single query with caching
   */
  private async executeQuery(
    query: PlannedQuery,
    filters?: GlobalFilters,
    skipCache: boolean = false,
    baseCacheKey?: string
  ): Promise<QueryResult> {
    const queryStart = Date.now();

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(query, filters, baseCacheKey);

      // Try cache first (if not skipped)
      if (!skipCache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          return {
            queryId: query.id,
            success: true,
            data: cached,
            duration: Date.now() - queryStart,
            cached: true,
            cacheKey,
          };
        }
      }

      // Execute based on query type
      let data: any;

      switch (query.type) {
        case 'WIQL':
          data = await this.executeWIQL(query, filters);
          break;

        case 'REST':
          data = await this.executeREST(query);
          break;

        case 'METADATA':
          data = await this.executeMetadata(query);
          break;

        default:
          throw new Error(`Unknown query type: ${query.type}`);
      }

      // Cache the result
      await this.cache.set(cacheKey, data, CACHE_TTL);

      return {
        queryId: query.id,
        success: true,
        data,
        duration: Date.now() - queryStart,
        cached: false,
        cacheKey,
      };
    } catch (error) {
      console.error(`Error executing query ${query.id}:`, error);

      return {
        queryId: query.id,
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - queryStart,
        cached: false,
      };
    }
  }

  /**
   * Execute a WIQL query
   */
  private async executeWIQL(
    query: PlannedQuery,
    filters?: GlobalFilters
  ): Promise<{ workItems: WorkItem[]; query: string }> {
    const adoService = this.getADOService();
    let wiqlQuery = query.query as string;

    // Apply global filters if present
    if (filters) {
      wiqlQuery = adoService.applyFiltersToQuery(wiqlQuery, filters);
    }

    // Execute WIQL
    const workItems = await adoService.searchWorkItems(wiqlQuery);

    return {
      workItems,
      query: wiqlQuery,
    };
  }

  /**
   * Execute a REST API query
   */
  private async executeREST(query: PlannedQuery): Promise<any> {
    const adoService = this.getADOService();
    const endpoint = query.query as string;

    // Map REST endpoints to ADO service methods
    if (endpoint.includes('/iterations') || endpoint.includes('/sprints')) {
      return await adoService.getSprints();
    }

    if (endpoint.includes('/teams')) {
      return await adoService.getTeams();
    }

    if (endpoint.includes('/users')) {
      return await adoService.getUsers();
    }

    // Generic REST call (fallback)
    throw new Error(`REST endpoint not mapped: ${endpoint}`);
  }

  /**
   * Execute a metadata query
   */
  private async executeMetadata(query: PlannedQuery): Promise<any> {
    const adoService = this.getADOService();
    const metadataType = query.query as string;

    switch (metadataType) {
      case 'users':
      case '/graph/users':
        return await adoService.getUsers();

      case 'states':
      case '/wit/workitemtypes/states':
        return await adoService.getStates();

      case 'types':
      case '/wit/workitemtypes':
        return await adoService.getTypes();

      case 'tags':
      case '/wit/tags':
        return await adoService.getTags();

      case 'projects':
      case '/projects':
        return await adoService.getProjects();

      case 'teams':
      case '/teams':
        return await adoService.getTeams();

      case 'sprints':
      case '/iterations':
        return await adoService.getSprints();

      default:
        throw new Error(`Unknown metadata type: ${metadataType}`);
    }
  }

  /**
   * Generate a cache key for a query
   */
  private generateCacheKey(
    query: PlannedQuery,
    filters?: GlobalFilters,
    baseCacheKey?: string
  ): string {
    const parts: string[] = [
      'ado',
      'query',
      baseCacheKey || '',
      query.id,
      query.type,
    ];

    // Add query hash
    parts.push(this.hashQuery(query.query));

    // Add filters if present
    if (filters) {
      if (filters.ignoreClosed) parts.push('ignoreClosed:true');
      if (filters.ignoreStates?.length) parts.push(`ignoreStates:${filters.ignoreStates.join(',')}`);
      if (filters.ignoreCreatedBy?.length) parts.push(`ignoreCreatedBy:${filters.ignoreCreatedBy.join(',')}`);
      if (filters.onlyMyTickets) parts.push('onlyMyTickets:true');
      if (filters.ignoreOlderThanDays) parts.push(`ignoreOlderThan:${filters.ignoreOlderThanDays}`);
      if (filters.currentUser) parts.push(`currentUser:${filters.currentUser}`);
    }

    return parts
      .filter(Boolean)
      .join(':')
      .replace(/[^a-zA-Z0-9:_-]/g, '_')
      .toLowerCase();
  }

  /**
   * Hash a query string for cache key
   */
  private hashQuery(query: string | object): string {
    const str = typeof query === 'string' ? query : JSON.stringify(query);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Invalidate cache for a specific key or pattern
   */
  async invalidateCache(pattern: string): Promise<void> {
    await this.cache.delete(pattern);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    keys: number;
    hits: number;
    misses: number;
  }> {
    // This would require tracking in Redis
    // For now, return placeholder
    return {
      keys: 0,
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Enrich work items with relationships (if needed)
   */
  async enrichWithRelationships(workItems: WorkItem[]): Promise<WorkItem[]> {
    const adoService = this.getADOService();
    return await adoService.enrichWorkItemsWithRelationships(workItems);
  }
}

export default QueryExecutor;
