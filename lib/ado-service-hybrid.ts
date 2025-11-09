/**
 * ADO Service Hybrid
 *
 * Intelligent service that uses Microsoft MCP server when available
 * and falls back to REST API for unsupported operations or failures.
 *
 * Strategy:
 * 1. Try MCP first for supported operations (sprints, search, projects, teams)
 * 2. Fall back to REST API on error or for unsupported operations
 * 3. Maintain exact same interface as ADOService for drop-in replacement
 */

import { ADOService } from './ado-api';
import { MCPADOService } from './mcp-ado-service';
import { WorkItem, GlobalFilters, Comment } from '@/types';

export class ADOServiceHybrid {
  private restService: ADOService;
  private mcpService?: MCPADOService; // Optional - only available when Anthropic API key is set
  private useMCP: boolean;
  private organization: string;
  private project?: string;

  constructor(
    organization: string,
    personalAccessToken: string,
    project?: string,
    options?: {
      useMCP?: boolean;
      anthropicApiKey?: string;
      useOpenRouter?: boolean;
    }
  ) {
    this.organization = organization;
    this.project = project;

    // Always create REST service as fallback
    this.restService = new ADOService(organization, personalAccessToken, project);

    // Create MCP service if enabled and API key available (Anthropic or OpenRouter)
    const anthropicApiKey = options?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const useOpenRouter = !!openRouterApiKey || options?.useOpenRouter;
    const apiKey = useOpenRouter ? openRouterApiKey : anthropicApiKey;

    this.useMCP = options?.useMCP !== false && !!apiKey && apiKey !== 'your-anthropic-api-key-here';

    if (this.useMCP) {
      try {
        this.mcpService = new MCPADOService(organization, project, {
          apiKey,
          useOpenRouter,
        });
        console.log(`[Hybrid Service] ✅ MCP service initialized with ${useOpenRouter ? 'OpenRouter' : 'Anthropic'}, will use MCP with REST fallback`);
      } catch (error) {
        console.warn('[Hybrid Service] ⚠️ Failed to initialize MCP service, using REST API only:', error);
        this.useMCP = false;
      }
    } else {
      console.log('[Hybrid Service] ℹ️ MCP disabled or no API key, using REST API only');
    }
  }

  /**
   * Search work items using WIQL
   * Strategy: Use REST API for WIQL (MCP search is different)
   */
  async searchWorkItems(query: string): Promise<WorkItem[]> {
    // MCP doesn't support custom WIQL queries well, always use REST API
    return this.restService.searchWorkItems(query);
  }

  /**
   * Get all non-closed work items for AI context
   * Strategy: Use REST API (optimized query)
   */
  async getAllNonClosedWorkItems(): Promise<WorkItem[]> {
    return this.restService.getAllNonClosedWorkItems();
  }

  /**
   * Apply filters to WIQL query
   * Strategy: Use REST API (WIQL manipulation)
   */
  applyFiltersToQuery(query: string, filters?: GlobalFilters): string {
    return this.restService.applyFiltersToQuery(query, filters);
  }

  /**
   * Build WIQL query based on command
   * Strategy: Use REST API (WIQL building)
   */
  buildQuery(command: string, param?: string, filters?: GlobalFilters): string {
    return this.restService.buildQuery(command, param, filters);
  }

  /**
   * Get a single work item by ID
   * Strategy: Try MCP first (same result), fallback to REST
   */
  async getWorkItem(id: string): Promise<WorkItem | null> {
    if (this.useMCP && this.mcpService) {
      try {
        return await this.mcpService.getWorkItem(id);
      } catch (error) {
        console.warn('[Hybrid Service] MCP getWorkItem failed, falling back to REST:', error);
      }
    }

    return this.restService.getWorkItem(id);
  }

  /**
   * Get all projects
   * Strategy: Try MCP first (better), fallback to REST
   */
  async getProjects(): Promise<{ id: string; name: string; description?: string }[]> {
    if (this.useMCP && this.mcpService) {
      try {
        return await this.mcpService.getProjects();
      } catch (error) {
        console.warn('[Hybrid Service] MCP getProjects failed, falling back to REST:', error);
      }
    }

    return this.restService.getProjects();
  }

  /**
   * Get teams for a project
   * Strategy: Try MCP first (same result), fallback to REST
   */
  async getTeams(projectName?: string): Promise<{ id: string; name: string; projectName: string }[]> {
    if (this.useMCP && this.mcpService) {
      try {
        return await this.mcpService.getTeams(projectName);
      } catch (error) {
        console.warn('[Hybrid Service] MCP getTeams failed, falling back to REST:', error);
      }
    }

    return this.restService.getTeams(projectName);
  }

  /**
   * Get sprints/iterations
   * Strategy: Try MCP first (MUCH better - includes timeframe!), fallback to REST
   */
  async getSprints(projectName?: string, teamId?: string): Promise<any[]> {
    if (this.useMCP && this.mcpService) {
      try {
        return await this.mcpService.getSprints(projectName, teamId);
      } catch (error) {
        console.warn('[Hybrid Service] MCP getSprints failed, falling back to REST:', error);
      }
    }

    return this.restService.getSprints(projectName, teamId);
  }

  /**
   * Get current sprint
   * Strategy: Use MCP sprints with timeframe filter, fallback to REST
   */
  async getCurrentSprint(projectName?: string, teamId?: string): Promise<any> {
    if (this.useMCP && this.mcpService) {
      try {
        const sprints = await this.mcpService.getSprints(projectName, teamId);
        // MCP includes timeFrame field - find "current"
        const currentSprint = sprints.find(s => s.timeFrame === 'current');
        if (currentSprint) {
          return currentSprint;
        }
      } catch (error) {
        console.warn('[Hybrid Service] MCP getCurrentSprint failed, falling back to REST:', error);
      }
    }

    return this.restService.getCurrentSprint(projectName, teamId);
  }

  /**
   * Get work items for current sprint
   * Strategy: Try MCP iteration query (better!), fallback to REST
   */
  async getCurrentSprintWorkItems(
    projectName?: string,
    teamId?: string,
    filters?: GlobalFilters
  ): Promise<WorkItem[]> {
    if (this.useMCP && this.mcpService) {
      try {
        // First get current sprint
        const currentSprint = await this.getCurrentSprint(projectName, teamId);
        if (currentSprint && currentSprint.id && teamId) {
          // Use MCP to get work items for iteration directly (no WIQL!)
          const workItems = await this.mcpService.getWorkItemsForIteration(
            projectName || this.project || this.organization,
            teamId,
            currentSprint.id
          );

          // Apply filters manually if needed
          if (filters) {
            return this.applyFiltersToWorkItems(workItems, filters);
          }

          return workItems;
        }
      } catch (error) {
        console.warn('[Hybrid Service] MCP getCurrentSprintWorkItems failed, falling back to REST:', error);
      }
    }

    return this.restService.getCurrentSprintWorkItems(projectName, teamId, filters);
  }

  /**
   * Get users
   * Strategy: Use REST API only (MCP doesn't have good user listing)
   */
  async getUsers(): Promise<{ displayName: string; uniqueName: string }[]> {
    return this.restService.getUsers();
  }

  /**
   * Get work item states
   * Strategy: Use REST API only
   */
  async getStates(): Promise<string[]> {
    return this.restService.getStates();
  }

  /**
   * Get work item types
   * Strategy: Use REST API only
   */
  async getTypes(): Promise<string[]> {
    return this.restService.getTypes();
  }

  /**
   * Get tags
   * Strategy: Use REST API only (MCP doesn't have tag extraction)
   */
  async getTags(): Promise<string[]> {
    return this.restService.getTags();
  }

  /**
   * Get saved queries
   * Strategy: Use REST API for now (MCP support exists but complex)
   */
  async getQueries(): Promise<{ id: string; name: string; path: string; wiql?: string }[]> {
    return this.restService.getQueries();
  }

  /**
   * Run a saved query
   * Strategy: Use REST API for now
   */
  async runQuery(queryId: string): Promise<{ workItems: WorkItem[]; queryName: string; queryPath: string }> {
    return this.restService.runQuery(queryId);
  }

  /**
   * Get comments for a work item
   * Strategy: Use REST API (MCP support exists but same result)
   */
  async getComments(workItemId: number): Promise<Comment[]> {
    return this.restService.getComments(workItemId);
  }

  /**
   * Get related work items
   * Strategy: Use REST API only (MCP doesn't handle $expand relations well)
   */
  async getRelatedWorkItems(workItemId: number): Promise<WorkItem[]> {
    return this.restService.getRelatedWorkItems(workItemId);
  }

  /**
   * Enrich work items with relationships
   * Strategy: Use REST API only
   */
  async enrichWorkItemsWithRelationships(workItems: WorkItem[]): Promise<WorkItem[]> {
    return this.restService.enrichWorkItemsWithRelationships(workItems);
  }

  /**
   * Full-text search using MCP (NEW METHOD - not in ADOService)
   * This is a bonus feature from MCP - relevance-ranked search!
   */
  async searchFullText(searchText: string, project?: string, top: number = 100): Promise<WorkItem[]> {
    if (this.useMCP && this.mcpService) {
      try {
        return await this.mcpService.searchWorkItemsFullText(searchText, project, top);
      } catch (error) {
        console.warn('[Hybrid Service] MCP searchFullText failed, no fallback available:', error);
        return [];
      }
    }

    console.warn('[Hybrid Service] MCP not available, full-text search requires MCP');
    return [];
  }

  // ==================== Private Helper Methods ====================

  /**
   * Apply global filters to work items array (client-side filtering)
   */
  private applyFiltersToWorkItems(workItems: WorkItem[], filters: GlobalFilters): WorkItem[] {
    let filtered = workItems;

    // Ignore states
    if (filters.ignoreStates && filters.ignoreStates.length > 0) {
      filtered = filtered.filter(item => !filters.ignoreStates!.includes(item.state));
    }

    // Ignore closed (legacy)
    if (filters.ignoreClosed) {
      filtered = filtered.filter(item => item.state !== 'Closed');
    }

    // Ignore created by
    if (filters.ignoreCreatedBy && filters.ignoreCreatedBy.length > 0) {
      filtered = filtered.filter(item => !filters.ignoreCreatedBy!.includes(item.createdBy));
    }

    // Only my tickets
    if (filters.onlyMyTickets && filters.currentUser) {
      filtered = filtered.filter(item => item.assignedTo.includes(filters.currentUser!));
    }

    // Ignore older than
    if (filters.ignoreOlderThanDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.ignoreOlderThanDays);

      filtered = filtered.filter(item => {
        const changedDate = new Date(item.changedDate || item.createdDate);
        return changedDate >= cutoffDate;
      });
    }

    return filtered;
  }

  /**
   * Check if MCP is enabled and available
   */
  isMCPEnabled(): boolean {
    return this.useMCP && !!this.mcpService;
  }

  /**
   * Get service status for debugging
   */
  getServiceStatus(): { useMCP: boolean; mcpAvailable: boolean; restAvailable: boolean } {
    return {
      useMCP: this.useMCP,
      mcpAvailable: !!this.mcpService,
      restAvailable: !!this.restService,
    };
  }
}
