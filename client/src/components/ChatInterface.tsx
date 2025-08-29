import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types/chat';
import ChatMessageComponent from './ChatMessage';
import ChatInput from './ChatInput';
import SuggestedQuery from './SuggestedQuery';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const suggestedQueries = [
  {
    icon: 'fas fa-dollar-sign',
    title: 'Treatment Costs',
    example: '"What is the cost of facelift?"',
    color: 'primary',
  },
  {
    icon: 'fas fa-list-ul',
    title: 'Service Lists',
    example: '"Show me all available treatments"',
    color: 'secondary',
  },
  {
    icon: 'fas fa-user-md',
    title: 'Doctor Info',
    example: '"Which doctors perform hair transplants?"',
    color: 'accent',
  },
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/chat', { message });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: Date.now().toString() + '-assistant',
          role: 'assistant',
          content: data.data.message,
          timestamp: data.data.timestamp,
          treatments: data.data.treatments,
          intent: data.data.intent,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to get response",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    },
    onError: (error) => {
      console.error('Chat error:', error);
      toast({
        title: "Connection Error",
        description: "Unable to connect to the AI assistant. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  const handleSendMessage = (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString() + '-user',
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    chatMutation.mutate(message);
  };

  const handleSuggestedQuery = (example: string) => {
    const query = example.replace(/['"]/g, '');
    handleSendMessage(query);
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 backdrop-blur-sm bg-opacity-95">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-stethoscope text-primary-foreground text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">HealthLantern AI</h1>
              <p className="text-sm text-muted-foreground">Your Healthcare Assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-secondary">
              <div className="w-2 h-2 bg-secondary rounded-full pulse-ring"></div>
              <span className="text-sm font-medium">Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 flex flex-col">
        {messages.length === 0 ? (
          <>
            {/* Welcome Message */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center space-x-2 bg-muted px-4 py-2 rounded-full text-sm text-muted-foreground mb-4">
                <i className="fas fa-robot text-primary"></i>
                <span>Powered by OpenAI & CopilotKit</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">How can I help you today?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Ask me about treatment costs, available services, doctor availability, or any healthcare-related questions.
              </p>
            </div>

            {/* Suggested Queries */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {suggestedQueries.map((query, index) => (
                <SuggestedQuery
                  key={index}
                  query={query}
                  onClick={() => handleSuggestedQuery(query.example)}
                  data-testid={`suggested-query-${index}`}
                />
              ))}
            </div>
          </>
        ) : null}

        {/* Chat Messages Container */}
        <div 
          ref={chatContainerRef}
          className="flex-1 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
          data-testid="chat-container"
        >
          {messages.map((message) => (
            <ChatMessageComponent 
              key={message.id} 
              message={message} 
              data-testid={`message-${message.id}`}
            />
          ))}
          
          {/* Loading Message */}
          {isLoading && (
            <div className="flex items-start space-x-3" data-testid="loading-message">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <i className="fas fa-robot text-primary-foreground text-sm"></i>
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">AI is thinking</span>
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <ChatInput 
            onSendMessage={handleSendMessage} 
            disabled={isLoading}
            data-testid="chat-input"
          />
          
          {/* API Status Indicator */}
          <div className="flex items-center justify-center mt-3 space-x-4 text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-secondary rounded-full"></div>
              <span>HealthLantern API Connected</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>OpenAI Integration Active</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <span>CopilotKit Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
