import ChatInterface from '@/components/ChatInterface';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-foreground">Thinkchat AI</h1>
          <a href="/settings">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </a>
        </div>
      </header>
      <ChatInterface />
    </div>
  );
}
