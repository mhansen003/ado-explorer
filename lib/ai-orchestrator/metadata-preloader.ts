/**
 * Metadata Preloader Service
 *
 * Preloads and caches all ADO metadata (sprints, users, queries, etc.)
 * in Redis for faster query planning and AI context.
 *
 * Benefits:
 * 1. Faster queries (no need to fetch metadata on every request)
 * 2. Better AI context (knows what sprints, users exist)
 * 3. More accurate query planning
 * 4. Reduced API calls to ADO
 */

import { ADOService } from '../ado-api';
import { CacheService } from '../redis/cacheService';

// Cache TTL: 30 minutes (longer than query cache)
const METADATA_CACHE_TTL = 1800; // 30 minutes in seconds

export interface PreloadedMetadata {
  sprints: any[];
  users: any[];
  states: any[];
  types: any[];
  tags: any[];
  queries: any[];
  projects: any[];
  teams: any[];
  lastUpdated: Date;
}

export class MetadataPreloader {
  private cache: CacheService;
  private adoService: ADOService;

  constructor() {
    this.cache = new CacheService();
    this.adoService = this.getADOService();
  }

  /**
   * Get ADO service instance
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
   * Preload all metadata and cache in Redis
   */
  async preloadAll(): Promise<PreloadedMetadata> {
    console.log('[Metadata Preloader] Starting metadata preload...');
    const startTime = Date.now();

    try {
      // Fetch all metadata in parallel
      const [sprints, users, states, types, tags, queries, projects, teams] =
        await Promise.all([
          this.preloadSprints(),
          this.preloadUsers(),
          this.preloadStates(),
          this.preloadTypes(),
          this.preloadTags(),
          this.preloadQueries(),
          this.preloadProjects(),
          this.preloadTeams(),
        ]);

      const metadata: PreloadedMetadata = {
        sprints,
        users,
        states,
        types,
        tags,
        queries,
        projects,
        teams,
        lastUpdated: new Date(),
      };

      // Store complete metadata in cache
      await this.cache.set('ado:metadata:all', metadata, METADATA_CACHE_TTL);

      const duration = Date.now() - startTime;
      console.log(`[Metadata Preloader] ✅ Preloaded all metadata in ${duration}ms`);
      console.log(`[Metadata Preloader] Stats:`, {
        sprints: sprints.length,
        users: users.length,
        states: states.length,
        types: types.length,
        tags: tags.length,
        queries: queries.length,
        projects: projects.length,
        teams: teams.length,
      });

      return metadata;
    } catch (error) {
      console.error('[Metadata Preloader] ❌ Failed to preload metadata:', error);
      throw error;
    }
  }

  /**
   * Get cached metadata (or preload if not cached)
   */
  async getMetadata(): Promise<PreloadedMetadata | null> {
    const cached = await this.cache.get<PreloadedMetadata>('ado:metadata:all');

    if (cached) {
      console.log('[Metadata Preloader] ✅ Using cached metadata');
      return cached;
    }

    console.log('[Metadata Preloader] ⚠️  Cache miss, preloading...');
    return await this.preloadAll();
  }

  /**
   * Get specific metadata type from cache
   */
  async getSprints(): Promise<any[]> {
    const metadata = await this.getMetadata();
    return metadata?.sprints || [];
  }

  async getUsers(): Promise<any[]> {
    const metadata = await this.getMetadata();
    return metadata?.users || [];
  }

  async getStates(): Promise<any[]> {
    const metadata = await this.getMetadata();
    return metadata?.states || [];
  }

  async getTypes(): Promise<any[]> {
    const metadata = await this.getMetadata();
    return metadata?.types || [];
  }

  async getTags(): Promise<any[]> {
    const metadata = await this.getMetadata();
    return metadata?.tags || [];
  }

  async getQueries(): Promise<any[]> {
    const metadata = await this.getMetadata();
    return metadata?.queries || [];
  }

  async getProjects(): Promise<any[]> {
    const metadata = await this.getMetadata();
    return metadata?.projects || [];
  }

  async getTeams(): Promise<any[]> {
    const metadata = await this.getMetadata();
    return metadata?.teams || [];
  }

  /**
   * Individual preload methods
   */
  private async preloadSprints(): Promise<any[]> {
    const cacheKey = 'ado:metadata:sprints';
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const sprints = await this.adoService.getSprints();
    await this.cache.set(cacheKey, sprints, METADATA_CACHE_TTL);
    return sprints;
  }

  private async preloadUsers(): Promise<any[]> {
    const cacheKey = 'ado:metadata:users';
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const users = await this.adoService.getUsers();
    await this.cache.set(cacheKey, users, METADATA_CACHE_TTL);
    return users;
  }

  private async preloadStates(): Promise<any[]> {
    const cacheKey = 'ado:metadata:states';
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const states = await this.adoService.getStates();
    await this.cache.set(cacheKey, states, METADATA_CACHE_TTL);
    return states;
  }

  private async preloadTypes(): Promise<any[]> {
    const cacheKey = 'ado:metadata:types';
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const types = await this.adoService.getTypes();
    await this.cache.set(cacheKey, types, METADATA_CACHE_TTL);
    return types;
  }

  private async preloadTags(): Promise<any[]> {
    const cacheKey = 'ado:metadata:tags';
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const tags = await this.adoService.getTags();
    await this.cache.set(cacheKey, tags, METADATA_CACHE_TTL);
    return tags;
  }

  private async preloadQueries(): Promise<any[]> {
    const cacheKey = 'ado:metadata:queries';
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const queries = await this.adoService.getQueries();
    await this.cache.set(cacheKey, queries, METADATA_CACHE_TTL);
    return queries;
  }

  private async preloadProjects(): Promise<any[]> {
    const cacheKey = 'ado:metadata:projects';
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const projects = await this.adoService.getProjects();
    await this.cache.set(cacheKey, projects, METADATA_CACHE_TTL);
    return projects;
  }

  private async preloadTeams(): Promise<any[]> {
    const cacheKey = 'ado:metadata:teams';
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const teams = await this.adoService.getTeams();
    await this.cache.set(cacheKey, teams, METADATA_CACHE_TTL);
    return teams;
  }

  /**
   * Force refresh all metadata (invalidate cache)
   */
  async refresh(): Promise<PreloadedMetadata> {
    console.log('[Metadata Preloader] 🔄 Forcing metadata refresh...');

    // Clear all metadata caches
    await this.cache.delete('ado:metadata:all');
    await this.cache.delete('ado:metadata:sprints');
    await this.cache.delete('ado:metadata:users');
    await this.cache.delete('ado:metadata:states');
    await this.cache.delete('ado:metadata:types');
    await this.cache.delete('ado:metadata:tags');
    await this.cache.delete('ado:metadata:queries');
    await this.cache.delete('ado:metadata:projects');
    await this.cache.delete('ado:metadata:teams');

    return await this.preloadAll();
  }

  /**
   * Get metadata stats
   */
  async getStats(): Promise<{
    cached: boolean;
    lastUpdated?: Date;
    counts: {
      sprints: number;
      users: number;
      states: number;
      types: number;
      tags: number;
      queries: number;
      projects: number;
      teams: number;
    };
  }> {
    const metadata = await this.cache.get<PreloadedMetadata>('ado:metadata:all');

    if (!metadata) {
      return {
        cached: false,
        counts: {
          sprints: 0,
          users: 0,
          states: 0,
          types: 0,
          tags: 0,
          queries: 0,
          projects: 0,
          teams: 0,
        },
      };
    }

    return {
      cached: true,
      lastUpdated: metadata.lastUpdated,
      counts: {
        sprints: metadata.sprints.length,
        users: metadata.users.length,
        states: metadata.states.length,
        types: metadata.types.length,
        tags: metadata.tags.length,
        queries: metadata.queries.length,
        projects: metadata.projects.length,
        teams: metadata.teams.length,
      },
    };
  }

  /**
   * Search sprints by name/path (fuzzy matching)
   */
  async findSprints(searchTerm: string): Promise<any[]> {
    const sprints = await this.getSprints();
    const lowerSearch = searchTerm.toLowerCase();

    return sprints.filter((sprint) => {
      const name = sprint.name?.toLowerCase() || '';
      const path = sprint.path?.toLowerCase() || '';
      return name.includes(lowerSearch) || path.includes(lowerSearch);
    });
  }

  /**
   * Search users by name/email
   */
  async findUsers(searchTerm: string): Promise<any[]> {
    const users = await this.getUsers();
    const lowerSearch = searchTerm.toLowerCase();

    return users.filter((user) => {
      const displayName = user.displayName?.toLowerCase() || '';
      const email = user.uniqueName?.toLowerCase() || '';
      return displayName.includes(lowerSearch) || email.includes(lowerSearch);
    });
  }

  /**
   * Get current sprint (if any)
   */
  async getCurrentSprint(): Promise<any | null> {
    const sprints = await this.getSprints();
    return sprints.find((s) => s.timeFrame === 'current') || null;
  }
}

export default MetadataPreloader;
