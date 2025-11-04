export interface Message {
  id: string;
  type: 'user' | 'system' | 'results';
  content: string;
  timestamp: Date;
  workItems?: WorkItem[];
  listItems?: Array<{value: string; description?: string; commandName?: string}>;
}

export interface WorkItem {
  id: string;
  title: string;
  type: string;
  state: string;
  assignedTo: string;
  createdBy: string;
  createdDate: string;
  priority: number;
  description?: string;
  tags?: string[];
  project?: string;
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
}

export interface ADOConfig {
  organization: string;
  project: string;
  personalAccessToken: string;
}
