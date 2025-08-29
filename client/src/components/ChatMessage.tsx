import { ChatMessage } from '@/types/chat';
import TreatmentCard from './TreatmentCard';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: ChatMessage;
}

export default function ChatMessageComponent({ message }: ChatMessageProps) {
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end message-fade-in" data-testid="user-message">
        <div className="max-w-xs lg:max-w-md bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3">
          <p className="text-sm">{message.content}</p>
          <span className="text-xs opacity-75 mt-1 block">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start space-x-3 message-fade-in" data-testid="assistant-message">
      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
        <i className="fas fa-robot text-primary-foreground text-sm"></i>
      </div>
      <div className="flex-1 max-w-2xl">
        <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
          <div className="prose prose-sm max-w-none">
            <p className="text-foreground mb-3">{message.content}</p>
            
            {/* Treatment Cards */}
            {message.treatments && message.treatments.length > 0 && (
              <div className="space-y-3 mt-4" data-testid="treatment-cards">
                {message.treatments.slice(0, 5).map((treatment) => (
                  <TreatmentCard key={treatment.id} treatment={treatment} />
                ))}
                
                {message.treatments.length > 5 && (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    Showing 5 of {message.treatments.length} treatments. Ask for more specific information to narrow down results.
                  </div>
                )}
              </div>
            )}

            {/* Additional Info */}
            {message.treatments && message.treatments.length > 0 && (
              <div className="mt-4 p-3 bg-secondary/5 border border-secondary/20 rounded-lg">
                <div className="flex items-start space-x-2">
                  <i className="fas fa-lightbulb text-secondary text-sm mt-0.5"></i>
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Need more information?</p>
                    <p className="text-muted-foreground">You can ask about specific doctors, compare treatments, or inquire about consultation booking.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground mt-2 block">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}
