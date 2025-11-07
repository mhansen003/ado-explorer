/**
 * AI Orchestrator Type Definitions
 *
 * These types define the structure for the AI-first query processing system.
 * Each phase of the orchestrator uses these interfaces to pass data through the pipeline.
 */

import { WorkItem, GlobalFilters } from '@/types';

// ============================================================================
// PHASE 1: INTENT ANALYSIS
// ============================================================================

export type IntentType = 'QUESTION' | 'COMMAND' | 'ANALYSIS' | 'SUMMARY';

export type IntentScope =
  | 'SPRINT'
  | 'USER'
  | 'PROJECT'
  | 'ISSUE'
  | 'DATE_RANGE'
  | 'TEAM'
  | 'BOARD'
  | 'TAG'
  | 'GLOBAL';

export type IntentComplexity = 'SIMPLE' | 'MULTI_STEP' | 'ANALYTICAL';

export interface Intent {
  type: IntentType;
  scope: IntentScope;
  entities: string[];
  dataRequired: boolean;
  complexity: IntentComplexity;
  confidence: number;
  originalQuery: string;

  // Parsed entity details
  sprintIdentifier?: string;
  userIdentifier?: string;
  issueId?: number;
  projectIdentifier?: string; // Specific project name (e.g., "Genesis", "Project Alpha")
  dateRange?: {
    start?: string;
    end?: string;
    relative?: string; // e.g., "last week", "this month"
  };
  teamIdentifier?: string;
  boardIdentifier?: string;
  tags?: string[];
  states?: string[];
  types?: string[];
}

// ============================================================================
// PHASE 2: DECISION ENGINE
// ============================================================================

export type QueryType = 'WIQL' | 'REST' | 'METADATA';

export interface Decision {
  requiresADO: boolean;
  queriesNeeded: QueryType[];
  analysisRequired: string[]; // e.g., ['velocity', 'blockers', 'trends']
  canUseCache: boolean;
  cacheKey?: string;
  estimatedComplexity: number; // 1-10 scale
  reasoning: string; // Why this decision was made
}

// ============================================================================
// PHASE 3: QUERY PLANNING
// ============================================================================

export interface ValidationRule {
  field: string;
  rule: string;
  errorMessage: string;
}

export interface PlannedQuery {
  id: string;
  type: QueryType;
  query: string | object;
  fields?: string[];
  purpose: string;
  dependsOn?: string[]; // IDs of queries that must execute first
  priority: number; // Execution order
  optional: boolean; // Can proceed if this fails
}

export interface QueryPlan {
  queries: PlannedQuery[];
  validationRules: ValidationRule[];
  successCriteria: string;
  fallbackStrategy?: string;
  estimatedDuration: number; // milliseconds
}

// ============================================================================
// PHASE 4: EXECUTION
// ============================================================================

export interface QueryResult {
  queryId: string;
  success: boolean;
  data: any;
  error?: string;
  duration: number;
  cached: boolean;
  cacheKey?: string;
}

export interface QueryResults {
  results: QueryResult[];
  workItems: WorkItem[];
  metadata: {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    totalDuration: number;
    cacheHits: number;
  };
  supplementaryData?: {
    sprints?: any[];
    users?: any[];
    teams?: any[];
    [key: string]: any;
  };
}

// ============================================================================
// PHASE 5: RESULT EVALUATION
// ============================================================================

export type DataQuality = 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
export type Relevance = 'LOW' | 'MEDIUM' | 'HIGH';
export type Completeness = 'INCOMPLETE' | 'PARTIAL' | 'COMPLETE';

export interface Evaluation {
  dataQuality: DataQuality;
  relevance: Relevance;
  completeness: Completeness;
  needsAdditional: boolean;
  additionalQueriesNeeded?: string[];
  insights: string[];
  warnings?: string[];
  confidence: number; // 0-1 scale
  reasoning: string;
}

// ============================================================================
// PHASE 6: SYNTHESIS
// ============================================================================

export interface AnalysisMetric {
  name: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  comparison?: string;
}

export interface AnalysisResult {
  title: string;
  summary: string;
  metrics: AnalysisMetric[];
  insights: string[];
  risks?: string[];
  recommendations?: string[];
}

export type VisualizationType =
  | 'burndown'
  | 'velocity'
  | 'status_pie'
  | 'priority_distribution'
  | 'team_comparison'
  | 'timeline'
  | 'blockers';

export interface Visualization {
  type: VisualizationType;
  title: string;
  data: any;
  config?: any;
}

export interface OrchestratedResponse {
  success: boolean;
  summary: string;
  analysis?: AnalysisResult;
  rawData: WorkItem[];
  suggestions: string[];
  visualizations?: Visualization[];
  metadata: {
    queriesExecuted: number;
    dataSources: string[];
    confidence: number;
    processingTime: number;
    cacheHit: boolean;
  };
  error?: string;
}

// ============================================================================
// CONVERSATION CONTEXT
// ============================================================================

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  userQuery: string;
  intent: Intent;
  response: OrchestratedResponse;
  workItems?: WorkItem[]; // Cached results from this turn
}

export interface ConversationContext {
  conversationId: string;
  userId: string;
  turns: ConversationTurn[];
  globalFilters?: GlobalFilters;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    [key: string]: any;
  };
}

// ============================================================================
// CACHE
// ============================================================================

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: Date;
  expiresAt: Date;
  hits: number;
}

export interface CacheStrategy {
  ttl: number; // Time to live in seconds
  namespace: string;
  invalidateOn?: string[]; // Events that invalidate cache
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

export interface OrchestratorConfig {
  models: {
    intent: string; // e.g., 'gpt-4o-mini'
    decision: string;
    planning: string; // e.g., 'gpt-4o'
    evaluation: string;
    synthesis: string;
  };
  cache: {
    enabled: boolean;
    ttl: number; // seconds
    namespace: string;
  };
  context: {
    maxTurns: number; // 7-10
    includeWorkItems: boolean;
  };
  retry: {
    enabled: boolean;
    maxAttempts: number;
    backoff: 'linear' | 'exponential';
  };
  performance: {
    timeout: number; // milliseconds
    parallelQueries: boolean;
  };
}

export interface OrchestratorInput {
  query: string;
  conversationId?: string;
  userId: string;
  filters?: GlobalFilters;
  options?: {
    skipCache?: boolean;
    verbose?: boolean;
  };
}

export interface OrchestratorMetrics {
  phase: string;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: any;
}

export interface OrchestratorResult {
  response: OrchestratedResponse;
  metrics: OrchestratorMetrics[];
  conversationContext: ConversationContext;
}
