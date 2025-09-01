import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LLMSettings from '@/components/LLMSettings'

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <a href="/chat">
            <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
          </a>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <i className="fas fa-cog text-white text-sm"></i>
            </div>
            <h1 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Settings</h1>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <i className="fas fa-brain text-white text-xl"></i>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">LLM Configuration</h2>
            <p className="text-slate-600 dark:text-slate-400 text-base max-w-2xl mx-auto">
              Configure your AI provider and model preferences for optimal healthcare assistance
            </p>
          </div>
          
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg p-6">
            <LLMSettings />
          </div>
        </div>
      </div>
    </div>
  )
}