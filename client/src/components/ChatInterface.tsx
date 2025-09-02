"use client"

import { useState, useRef, useEffect } from "react"
import type { ChatMessage } from "@/types/chat"
import ChatMessageComponent from "./ChatMessage"
import ChatInput from "./ChatInput"
import SuggestedQuery from "./SuggestedQuery"
import ThinkingIndicator from "./ThinkingIndicator"
import TypingIndicator from "./TypingIndicator"
import DeepThinkingIndicator from "./DeepThinkingIndicator"
import { useMutation, useQuery } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Menu, MessageSquare, Download, Trash2, Settings } from "lucide-react"

const suggestedQueries = [
  {
    icon: "fas fa-dollar-sign",
    title: "Treatment Costs",
    example: '"What is the cost of facelift?"',
    color: "primary",
  },
  {
    icon: "fas fa-list-ul",
    title: "Service Lists",
    example: '"Show me all available treatments"',
    color: "secondary",
  },
  {
    icon: "fas fa-user-md",
    title: "Doctor Info",
    example: '"Which doctors perform hair transplants?"',
    color: "accent",
  },
]

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chat-messages')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isDeepThinking, setIsDeepThinking] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isBookingCTAOpen, setIsBookingCTAOpen] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [isUserNearBottom, setIsUserNearBottom] = useState(true)
  const { toast } = useToast()

  // Dark mode toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  // Load dynamic greeting on mount
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await apiRequest("GET", "/api/greeting")
        const data = await res.json()
        if (mounted && data?.success && data.data?.message) {
          const assistantMessage: ChatMessage = {
            id: "assistant-greeting",
            role: "assistant",
            content: data.data.message,
            timestamp: new Date().toISOString(),
          }
          setMessages([assistantMessage])
        }
      } catch (e) {
        // ignore greeting failure
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Check API health status
  const { data: healthStatus } = useQuery({
    queryKey: ["api-health"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/health")
      return response.json()
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: false,
  })

  const handleStreamingResponse = async (message: string) => {
    // Temporarily disable streaming and use fallback for now
    console.log('Using fallback response (streaming disabled temporarily)')
    return handleFallbackResponse(message)
  }

  const handleFallbackResponse = async (message: string) => {
    try {
      console.log('Using fallback non-streaming response')
      const response = await apiRequest("POST", "/api/chat", { message })
      const data = await response.json()
      
      if (data.success) {
        // Simulate streaming by showing the message word by word
        const assistantMessage: ChatMessage = {
          id: Date.now().toString() + "-assistant",
          role: "assistant",
          content: "",
          treatments: data.data.treatments,
          intent: data.data.intent,
          timestamp: data.data.timestamp,
        }
        
        setStreamingMessage(assistantMessage)
        
        // Stream the content word by word
        const words = data.data.message.split(' ')
        for (let i = 0; i < words.length; i++) {
          const chunk = i === 0 ? words[i] : ' ' + words[i]
          assistantMessage.content += chunk
          setStreamingMessage({ ...assistantMessage })
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        
        // Finalize the message
        setMessages((prev) => {
          const newMessages = [...prev, assistantMessage]
          localStorage.setItem('chat-messages', JSON.stringify(newMessages))
          return newMessages
        })
        setStreamingMessage(null)
      } else {
        throw new Error(data.error || 'Chat request failed')
      }
    } catch (error) {
      console.error('Fallback chat error:', error)
      toast({
        title: "Connection Error",
        description: "Unable to connect to the AI assistant. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsDeepThinking(false)
    }
  }

  const isComplexQuery = (query: string) => {
    const complexKeywords = [
      'niti gaur', 'dr niti', 'doctor niti', 'who is',
      'compare', 'difference between', 'vs', 'versus',
      'detailed', 'comprehensive', 'explain', 'analysis',
      'research', 'study', 'scientific', 'medical history',
      'side effects', 'complications', 'risks', 'benefits',
      'procedure steps', 'how does', 'mechanism', 'process'
    ]
    return complexKeywords.some(keyword => query.toLowerCase().includes(keyword))
  }

  const handleSendMessage = (message: string) => {
    if (!message.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString() + "-user",
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => {
      const newMessages = [...prev, userMessage]
      localStorage.setItem('chat-messages', JSON.stringify(newMessages))
      return newMessages
    })
    
    const isComplex = isComplexQuery(message)
    setIsLoading(true)
    setIsDeepThinking(isComplex)
    handleStreamingResponse(message)
  }

  const handleSuggestedQuery = (example: string) => {
    const query = example.replace(/['"]/g, "")
    handleSendMessage(query)
  }

  // Scroll event handler to detect if user is near the bottom
  useEffect(() => {
    const chatDiv = chatContainerRef.current
    if (!chatDiv) return

    const handleScroll = () => {
      const threshold = 80 // px from bottom
      const isNearBottom = chatDiv.scrollHeight - chatDiv.scrollTop - chatDiv.clientHeight < threshold
      setIsUserNearBottom(isNearBottom)
    }
    chatDiv.addEventListener('scroll', handleScroll)
    return () => {
      chatDiv.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Auto-scroll behavior:
  // - If the user is near the bottom, always scroll to the bottom when messages update.
  // - If the user has scrolled up, don't jump their view.
  // This avoids placing a newly-sent user message at the top (which created a large empty
  // area when a larger assistant message with the appointment form was rendered later).
  useEffect(() => {
    const chatDiv = chatContainerRef.current;
    if (!chatDiv) return;

    // If the user has intentionally scrolled up, preserve their scroll position.
    if (!isUserNearBottom) return;

    // Safe, simple behavior: scroll to the bottom to show newest assistant content (including forms)
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }, [messages, isUserNearBottom]);

  const clearChat = () => {
    setMessages([])
    localStorage.removeItem('chat-messages')
  }

  const exportChat = () => {
    const chatData = messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
    const blob = new Blob([chatData], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'chat-export.txt'
    a.click()
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 shadow-xl transform transition-all duration-300 ${showSidebar ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Chat History</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowSidebar(false)} className="lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800">
                ×
              </Button>
            </div>
          </div>
          <div className="flex-1 p-6">
            <div className="space-y-3">
              <div className="group p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 cursor-pointer hover:from-blue-100 hover:to-purple-100 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 border border-slate-200/50 dark:border-slate-600/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">Current Session</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{messages.length} messages</p>
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 border-t border-slate-200/50 dark:border-slate-700/50 space-y-3 bg-gradient-to-r from-slate-50/50 to-blue-50/50 dark:from-slate-800/50 dark:to-slate-700/50">
            <Button variant="outline" size="sm" onClick={clearChat} className="w-full justify-start hover:bg-red-50 hover:border-red-200 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:border-red-800 dark:hover:text-red-400 transition-all duration-200">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Chat
            </Button>
            <div className="space-y-2">
              <Button variant="outline" size="sm" onClick={exportChat} className="w-full justify-start hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-900/20 dark:hover:border-blue-800 dark:hover:text-blue-400 transition-all duration-200">
                <Download className="w-4 h-4 mr-2" />
                Export Chat
              </Button>

              <a href="/settings">
                <Button variant="outline" size="sm" className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </a>

              <Button variant="outline" size="sm" onClick={() => setIsDarkMode(!isDarkMode)} className="w-full justify-start hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 dark:hover:bg-purple-900/20 dark:hover:border-purple-800 dark:hover:text-purple-400 transition-all duration-200">
                {isDarkMode ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">


        {/* Main Chat Container */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-2xl">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <i className="fas fa-stethoscope text-white text-xl"></i>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">Welcome to Thinkchat AI</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8 text-base">
                  Your intelligent healthcare assistant for Citrine Clinic. Ask about treatments, pricing, or book appointments.
                </p>
                
                {/* Suggested Queries */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {suggestedQueries.map((query, index) => (
                    <SuggestedQuery
                      key={index}
                      query={query}
                      onClick={() => handleSuggestedQuery(query.example)}
                      data-testid={`suggested-query-${index}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
              data-testid="chat-container"
              style={{ paddingBottom: isBookingCTAOpen ? '0' : '1rem' }}
            >
              <div className="max-w-4xl mx-auto">
                {messages.map((message, index) => (
                  <div key={message.id} className="animate-in slide-in-from-bottom-4 duration-300 mb-3" style={{animationDelay: `${index * 50}ms`}}>
                    <ChatMessageComponent 
                      message={message} 
                      onFormStateChange={setIsFormOpen}
                      onBookingCTAStateChange={setIsBookingCTAOpen}
                      isLatest={index === messages.length - 1}
                      data-testid={`message-${message.id}`} 
                    />
                  </div>
                ))}
                {streamingMessage && (
                  <div className="animate-in slide-in-from-bottom-4 duration-300 mb-3">
                    <ChatMessageComponent 
                      message={streamingMessage} 
                      onFormStateChange={setIsFormOpen}
                      onBookingCTAStateChange={setIsBookingCTAOpen}
                      isStreaming={true}
                      isLatest={true}
                      data-testid={`streaming-message`} 
                    />
                  </div>
                )}
                {isLoading && !streamingMessage && (
                  <div className="animate-in slide-in-from-bottom-4 duration-300">
                    {isDeepThinking ? <DeepThinkingIndicator /> : <TypingIndicator />}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Input Area */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 shadow-lg">
          <div className={`max-w-4xl mx-auto px-4 ${isBookingCTAOpen ? 'py-2' : 'py-4'}`}>
            {/* Always show ChatInput (do not hide when appointment CTA/form is open) */}
            <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} hideQuickActions={isBookingCTAOpen} data-testid="chat-input" />

            {/* API Status Indicator */}
            {/* {healthStatus?.success && (
              <div className="flex items-center justify-center mt-3 space-x-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center space-x-1.5 px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-full">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      healthStatus.data.apis.treatments === "OK"
                        ? "bg-green-500"
                        : healthStatus.data.apis.treatments === "Empty"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                  ></div>
                  <span>Treatment Data</span>
                </div>
                <div className="flex items-center space-x-1.5 px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-full">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      healthStatus.data.apis.doctors === "OK"
                        ? "bg-green-500"
                        : healthStatus.data.apis.doctors === "Empty"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                  ></div>
                  <span>Doctor Info</span>
                </div>
              </div>
            )} */}
          </div>
        </div>
      </div>
    </div>
  )
}
