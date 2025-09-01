"use client"

export default function TypingIndicator() {
  return (
    <div className="flex items-start space-x-3 animate-fade-in">
      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 shadow-lg">
        <i className="fas fa-robot text-white text-sm"></i>
      </div>
      <div className="flex-1 max-w-2xl">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-md px-6 py-4 shadow-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">HealthLantern AI is thinking</span>
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}