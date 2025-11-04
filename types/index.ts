export interface Message {
  id: string;
  type: 'user' | 'system' | 'results';
  content: string;
  timestamp: Date;
  workItems?: WorkItem[];
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
}

export interface ADOConfig {
  organization: string;
  project: string;
  personalAccessToken: string;
}
