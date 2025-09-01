"use client"

import type React from "react"

import { useState, useRef, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

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
      alert("Speech recognition not supported in this browser")
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
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setMessage(transcript)
      setIsRecording(false)
    }

    recognition.onerror = () => {
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  return (
    <div className="flex items-center space-x-3">
      {/* Input container: pill-shaped with outline on focus */}
      <div className={cn("flex-1 relative", disabled && "opacity-50 cursor-not-allowed")}>
        <div className="w-full rounded-full border border-border focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/20 transition-colors duration-200 bg-muted/70 px-4 py-2.5 flex items-center">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask about treatments, costs, doctors, or any healthcare question..."
            className={cn(
              "flex-1 resize-none bg-transparent outline-none text-foreground placeholder-muted-foreground pr-3 min-h-[40px] md:min-h-[44px] max-h-32 leading-6 text-sm",
              disabled && "opacity-50",
            )}
            rows={1}
            disabled={disabled}
            data-testid="message-input"
            aria-label="Message input"
          />

          {/* Send button: primary circular */}
          <button
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            className={cn(
              "ml-2 -mr-1 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
            )}
            data-testid="send-button"
            aria-label="Send message"
          >
            <i className="fas fa-paper-plane text-sm" />
          </button>
        </div>
      </div>

      {/* Voice Input Button (separate, green) */}
      <button
        onClick={handleVoiceInput}
        disabled={disabled}
        className={cn(
          "w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-md",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        data-testid="voice-button"
        aria-label={isRecording ? "Stop recording" : "Start voice input"}
      >
        <i className={cn("fas", isRecording ? "fa-stop text-white" : "fa-microphone")}></i>
      </button>
    </div>
  )
}
