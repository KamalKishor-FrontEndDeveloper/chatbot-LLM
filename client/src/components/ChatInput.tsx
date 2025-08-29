import { useState, useRef, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    
    onSendMessage(message.trim());
    setMessage('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  };

  const handleVoiceInput = () => {
    // TODO: Implement speech recognition
    console.log('Voice input would be implemented here');
  };

  return (
    <div className="flex items-end space-x-3">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask about treatments, costs, doctors, or any healthcare question..."
          className={cn(
            "w-full bg-card border border-border rounded-2xl px-4 py-3 pr-12 text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 min-h-[48px] max-h-32",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          rows={1}
          disabled={disabled}
          data-testid="message-input"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className={cn(
            "absolute right-2 bottom-2 w-8 h-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg flex items-center justify-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          data-testid="send-button"
        >
          <i className="fas fa-paper-plane text-sm"></i>
        </button>
      </div>
      
      {/* Voice Input Button */}
      <button
        onClick={handleVoiceInput}
        disabled={disabled}
        className={cn(
          "w-12 h-12 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-xl flex items-center justify-center transition-colors duration-200",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        data-testid="voice-button"
      >
        <i className="fas fa-microphone"></i>
      </button>
    </div>
  );
}
