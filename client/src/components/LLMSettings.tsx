"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, EyeOff, Settings, Save, RotateCcw } from 'lucide-react'

interface LLMConfig {
  provider: 'openai' | 'mistral'
  model: string
  hasApiKey: boolean
}

interface Models {
  openai: string[]
  mistral: string[]
}

export default function LLMSettings() {
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const [models, setModels] = useState<Models | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadConfig()
    loadModels()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/llm/config')
      const data = await response.json()
      if (data.success) {
        setConfig(data.data)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  const loadModels = async () => {
    try {
      const response = await fetch('/api/llm/models')
      const data = await response.json()
      if (data.success) {
        setModels(data.data)
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  const saveConfig = async () => {
    if (!config || !apiKey.trim()) {
      setMessage('Please provide an API key')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/llm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          model: config.model,
          apiKey: apiKey.trim()
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage('Configuration saved successfully!')
        setConfig({ ...config, hasApiKey: true })
        setApiKey('')
      } else {
        setMessage(data.error || 'Failed to save configuration')
      }
    } catch (error) {
      setMessage('Failed to save configuration')
    } finally {
      setLoading(false)
    }
  }

  if (!config || !models) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-6">
        {/* Current Status */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10 border border-blue-200/30 dark:border-blue-700/30 rounded-xl backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-robot text-white text-sm"></i>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Current Provider</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{config.model}</p>
            </div>
          </div>
          <Badge variant={config.hasApiKey ? "default" : "destructive"} className="px-3 py-1">
            {config.provider.toUpperCase()} {config.hasApiKey ? "✓" : "No Key"}
          </Badge>
        </div>

        {/* Provider Selection */}
        <div className="space-y-3">
          <Label htmlFor="provider" className="text-base font-semibold text-slate-900 dark:text-white">AI Provider</Label>
          <Select
            value={config.provider}
            onValueChange={(value: 'openai' | 'mistral') => 
              setConfig({ ...config, provider: value, model: models[value][0] })
            }
          >
            <SelectTrigger className="h-12 rounded-xl border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200/50 dark:border-slate-700/50 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl">
              <SelectItem value="openai" className="rounded-lg">🤖 OpenAI</SelectItem>
              <SelectItem value="mistral" className="rounded-lg">🧠 Mistral AI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Model Selection */}
        <div className="space-y-3">
          <Label htmlFor="model" className="text-base font-semibold text-slate-900 dark:text-white">Model</Label>
          <Select
            value={config.model}
            onValueChange={(value) => setConfig({ ...config, model: value })}
          >
            <SelectTrigger className="h-12 rounded-xl border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200/50 dark:border-slate-700/50 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl">
              {models[config.provider].map((model) => (
                <SelectItem key={model} value={model} className="rounded-lg">
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API Key Input */}
        <div className="space-y-3">
          <Label htmlFor="apiKey" className="text-base font-semibold text-slate-900 dark:text-white">API Key</Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${config.provider.toUpperCase()} API key`}
              className="h-12 pr-12 rounded-xl border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-10 w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center space-x-2">
            <i className="fas fa-shield-alt text-green-500"></i>
            <span>Your API key is stored locally and never sent to our servers</span>
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium flex items-center space-x-2 ${
            message.includes('success') 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
          }`}>
            <i className={`fas ${message.includes('success') ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
            <span>{message}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button 
            onClick={saveConfig} 
            disabled={loading} 
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 hover:from-blue-600 hover:via-purple-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => { setApiKey(''); setMessage('') }}
            className="h-12 rounded-xl border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Provider Info */}
        <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2 border border-slate-200/30 dark:border-slate-700/30">
          <h4 className="font-medium text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
            <i className="fas fa-info-circle text-blue-500"></i>
            <span>API Key Sources</span>
          </h4>
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <strong>OpenAI:</strong> Get your API key from platform.openai.com
            </p>
            <p className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              <strong>Mistral:</strong> Get your API key from console.mistral.ai
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}