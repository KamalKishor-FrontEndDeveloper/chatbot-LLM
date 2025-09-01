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
        "group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-300 dark:hover:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
      )}
      onClick={onClick}
      aria-label={`Ask about ${query.title}`}
      data-testid="suggested-query-button"
    >
      <div className="flex items-start space-x-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110",
          "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg"
        )}>
          <i className={cn(query.icon, "text-lg")}></i>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900 dark:text-white text-base mb-2">{query.title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{query.example}</p>
        </div>
      </div>
    </button>
  )
}
