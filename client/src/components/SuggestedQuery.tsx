import { SuggestedQuery as SuggestedQueryType } from '@/types/chat';
import { cn } from '@/lib/utils';

interface SuggestedQueryProps {
  query: SuggestedQueryType;
  onClick: () => void;
}

export default function SuggestedQuery({ query, onClick }: SuggestedQueryProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'primary':
        return 'hover:border-primary/50 group-hover:bg-primary/20 text-primary';
      case 'secondary':
        return 'hover:border-secondary/50 group-hover:bg-secondary/20 text-secondary';
      case 'accent':
        return 'hover:border-accent/50 group-hover:bg-accent/20 text-accent';
      default:
        return 'hover:border-primary/50 group-hover:bg-primary/20 text-primary';
    }
  };

  const colorClasses = getColorClasses(query.color);

  return (
    <button 
      className={cn(
        "bg-card border border-border rounded-lg p-4 text-left transition-all duration-200 hover:shadow-md group",
        colorClasses.split(' ')[0]
      )}
      onClick={onClick}
      data-testid="suggested-query-button"
    >
      <div className="flex items-start space-x-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
          `bg-${query.color}/10`,
          colorClasses.split(' ')[1]
        )}>
          <i className={cn(query.icon, "text-sm", colorClasses.split(' ')[2])}></i>
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground text-sm">{query.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{query.example}</p>
        </div>
      </div>
    </button>
  );
}
