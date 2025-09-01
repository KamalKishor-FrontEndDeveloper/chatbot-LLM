"use client"

import { useState, useRef, useEffect } from "react"
import type { ChatMessage } from "@/types/chat"
import ChatMessageComponent from "./ChatMessage"
import ChatInput from "./ChatInput"
import SuggestedQuery from "./SuggestedQuery"
import ThinkingIndicator from "./ThinkingIndicator"
import { useMutation, useQuery } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"

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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

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

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/chat", { message })
      return response.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: Date.now().toString() + "-assistant",
          role: "assistant",
          content: data.data.message,
          timestamp: data.data.timestamp,
          treatments: data.data.treatments,
          intent: data.data.intent,
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to get response",
          variant: "destructive",
        })
      }
      setIsLoading(false)
    },
    onError: (error) => {
      console.error("Chat error occurred")
      toast({
        title: "Connection Error",
        description: "Unable to connect to the AI assistant. Please try again.",
        variant: "destructive",
      })
      setIsLoading(false)
    },
  })

  const handleSendMessage = (message: string) => {
    if (!message.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString() + "-user",
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    chatMutation.mutate(message)
  }

  const handleSuggestedQuery = (example: string) => {
    const query = example.replace(/['"]/g, "")
    handleSendMessage(query)
  }

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm ring-1 ring-primary/20">
              <i className="fas fa-stethoscope text-primary-foreground text-lg"></i>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-semibold text-foreground leading-tight">HealthLantern AI</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Your Healthcare Assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"></div>
              <span className="text-xs md:text-sm font-medium">Live</span>
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
                <span>Powered by Citrine Clinic</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">How can I help you today?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Ask me about treatment costs, available services, doctor availability, or any healthcare-related
                questions.
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
          className="flex-1 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent rounded-xl bg-muted/10 p-2 md:p-3"
          data-testid="chat-container"
        >
          {messages.map((message) => (
            <ChatMessageComponent key={message.id} message={message} data-testid={`message-${message.id}`} />
          ))}

          {/* Enhanced Loading Message */}
          {isLoading && <ThinkingIndicator />}
        </div>
      </main>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-background/90 backdrop-blur-sm border-t border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 md:py-4">
          <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} data-testid="chat-input" />

          {/* API Status Indicator */}
          {healthStatus?.success && (
            <div className="flex items-center justify-center mt-3 space-x-4 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    healthStatus.data.apis.treatments === "OK"
                      ? "bg-green-500"
                      : healthStatus.data.apis.treatments === "Empty"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                ></div>
                <span>Treatment Data {healthStatus.data.apis.treatments === "Failed" ? "(Using Backup)" : ""}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    healthStatus.data.apis.doctors === "OK"
                      ? "bg-green-500"
                      : healthStatus.data.apis.doctors === "Empty"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                ></div>
                <span>Doctor Info {healthStatus.data.apis.doctors === "Failed" ? "(Using Backup)" : ""}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
