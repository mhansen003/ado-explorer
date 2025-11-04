import { Message } from '@/types';
import WorkItemCard from './WorkItemCard';
import { Bot, User } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="flex gap-3">
          {message.type === 'user' ? (
            <div className="w-8 h-8 rounded-full bg-rh-green flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-rh-dark" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-rh-card border border-rh-border flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-rh-green" />
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-rh-text">
                {message.type === 'user' ? 'You' : 'ADO Explorer'}
              </span>
              <span className="text-xs text-rh-text-secondary">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>

            {message.type === 'results' && message.workItems ? (
              <div className="space-y-2 mt-3">
                <p className="text-sm text-rh-text-secondary mb-3">
                  Found {message.workItems.length} work items
                </p>
                {message.workItems.map((item) => (
                  <WorkItemCard key={item.id} workItem={item} />
                ))}
              </div>
            ) : (
              <div className="text-rh-text whitespace-pre-wrap text-sm">
                {message.content}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
