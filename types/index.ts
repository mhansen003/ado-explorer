export interface ChartData {
  chartType: 'pie' | 'bar' | 'line' | 'area';
  dataKey: 'state' | 'type' | 'priority' | 'assignedTo' | 'createdBy' | 'project' | 'areaPath' | 'changedBy' | 'iterationPath' | 'storyPoints' | 'tags';
  data: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
}

export interface Message {
  id: string;
  type: 'user' | 'system' | 'results';
  content: string;
  timestamp: Date;
  workItems?: WorkItem[];
  listItems?: Array<{value: string; description?: string; commandName?: string}>;
  conversationalAnswer?: string;
  responseType?: 'TICKETS' | 'ANSWER';
  suggestions?: string[];
  chartData?: ChartData;
}

export interface WorkItem {
  id: string;
  title: string;
  type: string;
  state: string;
  assignedTo: string;
  assignedToEmail?: string;
  createdBy: string;
  createdByEmail?: string;
  createdDate: string;
  priority: number;
  description?: string;
  tags?: string[];
  project?: string;
  changedDate?: string;
  changedBy?: string;
  changedByEmail?: string;
  iterationPath?: string;
  areaPath?: string;
  storyPoints?: number;
  acceptanceCriteria?: string;
  relationType?: string; // How this item is related (Parent, Child, Related, etc.)
  relationSource?: 'linked' | 'tag' | 'title'; // How we found this relation
}

export interface Command {
  name: string;
  description: string;
  icon: string;
  hasParam?: boolean;
  isDynamic?: boolean;
}

export interface DynamicSuggestion {
  value: string;
  description?: string;
  metadata?: string; // Additional info like full path for queries
}

export interface ADOConfig {
  organization: string;
  project: string;
  personalAccessToken: string;
}

export interface GlobalFilters {
  ignoreClosed: boolean; // Legacy - kept for backwards compatibility
  ignoreStates: string[]; // Multi-select states to ignore (e.g., ["Closed", "Removed", "Archived"])
  ignoreCreatedBy: string[]; // Multi-select users to ignore by created by
  onlyMyTickets: boolean;
  ignoreOlderThanDays: number | null;
  currentUser?: string;
}

export interface ViewPreferences {
  useGridView: boolean;
}

export interface Comment {
  id: number;
  text: string;
  createdBy: string;
  createdByEmail?: string;
  createdDate: string;
  modifiedBy?: string;
  modifiedByEmail?: string;
  modifiedDate?: string;
}

export type PlaceholderType = 'user' | 'project' | 'state' | 'type' | 'tag' | 'board' | 'text' | 'days' | 'query' | 'sprint' | 'chartType' | 'chartDimension';

export interface Placeholder {
  key: string; // unique key for this placeholder
  type: PlaceholderType; // what kind of data to show
  label: string; // display label (e.g., "created by")
  required: boolean; // is this placeholder required?
  multiSelect?: boolean; // allow multiple selections (for tags)
}

export interface CommandTemplate {
  id: string;
  displayText: string; // "Show me all tickets created by {user}"
  description: string; // Short description
  icon: string; // Emoji icon
  placeholders: Placeholder[];
  buildCommand: (values: Record<string, string | string[]>) => string; // Build the actual /command
}
