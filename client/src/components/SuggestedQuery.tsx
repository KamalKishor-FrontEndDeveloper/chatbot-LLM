"use client"

import type { SuggestedQuery as SuggestedQueryType } from "@/types/chat"
import { cn } from "@/lib/utils"

interface SuggestedQueryProps {
  query: SuggestedQueryType
  onClick: () => void
}

export default function SuggestedQuery({ query, onClick }: SuggestedQueryProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case "primary":
        return { text: "text-primary", ring: "ring-primary/30", bgSoft: "bg-primary/10" }
      case "secondary":
        return { text: "text-secondary", ring: "ring-secondary/30", bgSoft: "bg-secondary/10" }
      case "accent":
        return { text: "text-accent", ring: "ring-accent/30", bgSoft: "bg-accent/10" }
      default:
        return { text: "text-primary", ring: "ring-primary/30", bgSoft: "bg-primary/10" }
    }
  }
  const color = getColorClasses(query.color)

  return (
    <button
      className={cn(
        "bg-card border border-border rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2",
        color.ring,
      )}
      onClick={onClick}
      aria-label={`Ask about ${query.title}`}
      data-testid="suggested-query-button"
    >
      <div className="flex items-start space-x-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", color.bgSoft)}>
          <i className={cn(query.icon, "text-sm", color.text)}></i>
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground text-sm">{query.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{query.example}</p>
        </div>
      </div>
    </button>
  )
}
