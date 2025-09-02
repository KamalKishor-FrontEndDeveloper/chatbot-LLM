"use client"

import type React from "react"
import { useState, useRef, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Send, Mic, MicOff } from "lucide-react"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (!message.trim() || disabled) return

    onSendMessage(message.trim())
    setMessage("")

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + "px"
    }
  }

  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<any>(null)

  const handleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Voice input not supported in this browser. Please use Chrome, Edge, or Safari.")
      return
    }

    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-US"

    recognition.onstart = () => {
      setIsRecording(true)
      console.log('Voice recording started')
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      console.log('Voice transcript:', transcript)
      setMessage(transcript)
      setIsRecording(false)
    }

    recognition.onerror = (event: any) => {
      console.error('Voice recognition error:', event.error)
      setIsRecording(false)
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access and try again.')
      }
    }

    recognition.onend = () => {
      console.log('Voice recording ended')
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  return (
    <div className="space-y-3">
      {/* Main Input Container */}
      <div className={cn("relative group", disabled && "opacity-50 cursor-not-allowed")}>
        <div className="bg-white/95 dark:bg-slate-800/95 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg backdrop-blur-xl hover:shadow-xl transition-all duration-300 group-hover:border-blue-300/50 dark:group-hover:border-blue-600/50">
          <div className="flex items-end gap-3 p-3">
            {/* Text Input */}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask about treatments, pricing, or book an appointment..."
                className={cn(
                  "w-full resize-none bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm leading-6 min-h-[24px] max-h-32 transition-all duration-200",
                  disabled && "opacity-50",
                )}
                rows={1}
                disabled={disabled}
                data-testid="message-input"
                aria-label="Message input"
              />
            </div>

            {/* Voice Input */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleVoiceInput}
              disabled={disabled}
              className={cn(
                "h-9 w-9 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md",
                isRecording 
                  ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white" 
                  : "hover:bg-slate-100 dark:hover:bg-slate-700"
              )}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
            </Button>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={!message.trim() || disabled}
              size="sm"
              className="h-9 w-9 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 hover:from-blue-600 hover:via-purple-600 hover:to-indigo-700 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSendMessage('Book an appointment')}
          className="rounded-xl text-xs px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          📅 Book an appointment
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSendMessage('What is the cost of LHR?')}
          className="rounded-xl text-xs px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-600 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          � What is the cost of LHR
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSendMessage('Know about Dr Niti Gaur')}
          className="rounded-xl text-xs px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          �‍⚕️ Know about Dr Niti Gaur
        </Button>
      </div>
    </div>
  )
}