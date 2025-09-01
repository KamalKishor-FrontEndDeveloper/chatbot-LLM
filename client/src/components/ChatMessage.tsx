"use client"

import React from "react"
import type { ChatMessage } from "@/types/chat"
import TreatmentCard from "./TreatmentCard"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import AppointmentForm from "./AppointmentForm"
import ContactQuoteForm from "./ContactQuoteForm"

interface ChatMessageProps {
  message: ChatMessage
}

interface AppointmentData {
  name: string
  email: string
  phone: string
  date: string
  service: string
  message: string
}

export default function ChatMessageComponent({ message }: ChatMessageProps) {
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  // State to manage the visibility of the appointment form, CTA and submission result
  const [showForm, setShowForm] = React.useState(false)
  const [formSubmitted, setFormSubmitted] = React.useState(false)
  const [submitResult, setSubmitResult] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showBookingCTA, setShowBookingCTA] = React.useState(false)
  const [showQuoteForm, setShowQuoteForm] = React.useState(false)
  const [quoteService, setQuoteService] = React.useState("")
  const [initialAppointmentData, setInitialAppointmentData] = React.useState<Partial<AppointmentData> | undefined>(
    undefined,
  )

  // Handler for when the appointment form is submitted
  const handleAppointmentSubmit = async (data: AppointmentData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/appointments/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          preferredDoctor: (data as any).preferredDoctor || undefined,
          time: (data as any).time || undefined,
          consent: (data as any).consent || false,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSubmitResult(
          `✅ **Appointment Booked Successfully!**\n\nThank you, ${data.name}! Your appointment for ${data.service} on ${data.date} at ${(data as any).time || "the selected time"} has been booked. ${(data as any).preferredDoctor ? `Requested Doctor: ${(data as any).preferredDoctor}. ` : ""}We will contact you at ${data.email} or ${data.phone} for confirmation.`,
        )
      } else {
        setSubmitResult(
          `❌ **Booking Failed**\n\n${result.message || "Please try again or contact our clinic directly."}`,
        )
      }
    } catch (error) {
      setSubmitResult(
        `❌ **Booking Error**\n\nUnable to book appointment. Please contact our clinic directly at **9654122458**.`,
      )
    }

    setFormSubmitted(true)
    setIsSubmitting(false)
    setShowForm(false)
  }

  // Handler to cancel the form
  const handleFormCancel = () => {
    setShowForm(false)
    // Optionally, you might want to reset other states here if needed
  }

  // Use server-provided intent to decide whether to surface booking CTA
  React.useEffect(() => {
    if (message.intent === "appointment_booking" && !formSubmitted) {
      setShowBookingCTA(true)
    } else {
      setShowBookingCTA(false)
    }
  }, [message.intent, formSubmitted])

  if (message.role === "user") {
    return (
      <div className="flex justify-end message-fade-in" data-testid="user-message">
        <div className="max-w-xs lg:max-w-md bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3 shadow-sm">
          <p className="text-sm leading-6">{message.content}</p>
          <span className="text-[10px] opacity-80 mt-1 block text-right">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    )
  }

  // If form was submitted, show the result
  if (formSubmitted && submitResult) {
    return (
      <div className="flex mb-4 justify-start">
        <div className="max-w-[80%] order-1">
          <div className="flex items-center mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mr-2 ring-1 ring-primary/20">
              <i className="fas fa-robot text-sm"></i>
            </div>
            <span className="text-sm font-medium text-foreground">HealthLantern AI</span>
          </div>

          <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-card border border-border shadow-sm">
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{submitResult}</ReactMarkdown>
            </div>
            <span className="text-[10px] text-muted-foreground mt-2 block">{formatTime(message.timestamp)}</span>
          </div>
        </div>
      </div>
    )
  }

  // If showing appointment form
  if (showForm) {
    return (
      <div className="flex mb-4 justify-start">
        <div className="max-w-[80%] order-1">
          <div className="flex items-center mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mr-2 ring-1 ring-primary/20">
              <i className="fas fa-robot text-sm"></i>
            </div>
            <span className="text-sm font-medium text-foreground">HealthLantern AI</span>
          </div>

          <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-card border border-border shadow-sm">
            <div className="max-w-sm">
              <AppointmentForm
                onSubmit={handleAppointmentSubmit}
                onCancel={handleFormCancel}
                isSubmitting={isSubmitting}
                initialData={initialAppointmentData}
              />
            </div>
            <span className="text-[10px] text-muted-foreground mt-2 block">{formatTime(message.timestamp)}</span>
          </div>
        </div>
      </div>
    )
  }

  // If server signaled appointment intent, show a non-intrusive CTA instead of auto-opening form
  if (showBookingCTA) {
    return (
      <div className="flex mb-4 justify-start">
        <div className="max-w-[80%] order-1">
          <div className="flex items-center mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mr-2 ring-1 ring-primary/20">
              <i className="fas fa-robot text-sm"></i>
            </div>
            <span className="text-sm font-medium text-foreground">HealthLantern AI</span>
          </div>

          <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-card border border-border shadow-sm">
            <div className="text-sm mb-3 text-foreground">
              It looks like you'd like to book an appointment. Citrine Clinic will help — proceed to book one now.
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  // Prefill remains unchanged
                  const prefill: Partial<AppointmentData> = {}
                  if (message.treatments && message.treatments.length > 0) {
                    const t = message.treatments[0]
                    prefill.service = t.t_name || t.name || ""
                  } else {
                    const match = message.content.match(/Contact for Quote -\s*(.+?)\b/)
                    if (match) prefill.service = match[1]
                  }
                  // @ts-ignore
                  if ((message as any).appointmentContext) {
                    const ctx = (message as any).appointmentContext
                    if (ctx.suggestedService) prefill.service = ctx.suggestedService
                    if (ctx.suggestedDoctors && ctx.suggestedDoctors.length > 0)
                      (prefill as any).preferredDoctor = ctx.suggestedDoctors[0]
                  }
                  setInitialAppointmentData(prefill)
                  setShowForm(true)
                  setShowBookingCTA(false)
                }}
                className="flex-1 rounded-full"
              >
                Book Appointment
              </Button>
              <Button variant="outline" onClick={() => setShowBookingCTA(false)} className="flex-1 rounded-full">
                No thanks
              </Button>
            </div>
            <span className="text-[10px] text-muted-foreground mt-2 block">{formatTime(message.timestamp)}</span>
          </div>
        </div>
      </div>
    )
  }

  // Default assistant message rendering
  return (
    <div className="flex items-start space-x-3 message-fade-in" data-testid="assistant-message">
      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-primary/20">
        <i className="fas fa-robot text-primary-foreground text-sm"></i>
      </div>
      <div className="flex-1 max-w-2xl">
        <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3 md:px-5 md:py-4 shadow-sm">
          <div className="prose prose-sm max-w-none text-foreground leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => {
                  // Check if this paragraph contains a contact quote link
                  const content = String(children)
                  const quoteMatch = content.match(/\[Contact for Quote - (.+?)\]/)

                  if (quoteMatch) {
                    const serviceName = quoteMatch[1]
                    return (
                      <p className="mb-3 last:mb-0">
                        {content.split(quoteMatch[0])[0]}
                        <button
                          onClick={() => {
                            setQuoteService(serviceName)
                            setShowQuoteForm(true)
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-full text-sm hover:bg-blue-700 transition-colors"
                        >
                          📞 Contact for Quote - {serviceName}
                        </button>
                        {content.split(quoteMatch[0])[1]}
                      </p>
                    )
                  }

                  return <p className="mb-3 last:mb-0">{children}</p>
                },
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                ul: ({ children }) => <ul className="list-disc pl-6 mb-3">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-6 mb-3">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                h1: ({ children }) => <h1 className="text-xl font-bold mb-3">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-medium mb-2">{children}</h3>,
              }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Treatment Cards */}
            {message.treatments && message.treatments.length > 0 && (
              <div className="space-y-3 mt-4" data-testid="treatment-cards">
                {message.treatments.slice(0, 5).map((treatment) => (
                  <TreatmentCard key={treatment.id} treatment={treatment} />
                ))}

                {message.treatments.length > 5 && (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    Showing 5 of {message.treatments.length} treatments. Ask for more specific information to narrow
                    down results.
                  </div>
                )}
              </div>
            )}

            {/* Additional Info */}
            {message.treatments && message.treatments.length > 0 && (
              <div className="mt-4 p-3 bg-secondary/5 border border-secondary/20 rounded-lg">
                <div className="flex items-start space-x-2">
                  <i className="fas fa-lightbulb text-secondary text-sm mt-0.5"></i>
                  <div className="text-sm">
                    <p className="font-medium text-foreground m-0 p-0 ">Need more information?</p>
                    <p className="text-muted-foreground">
                      You can ask about specific doctors, compare treatments, or inquire about consultation booking.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-2 block">{formatTime(message.timestamp)}</span>
        </div>
      </div>

      {/* Contact Quote Form Modal */}
      {showQuoteForm && (
        <ContactQuoteForm
          serviceName={quoteService}
          onClose={() => setShowQuoteForm(false)}
          onSuccess={() => {
            setShowQuoteForm(false)
            setSubmitResult(
              `✅ **Quote Request Sent!**\n\nThank you for your interest in ${quoteService}. We'll contact you shortly with personalized pricing and details.\n\n💡 **Citrine Clinic will help with more information about other treatments or services if you need it.**`,
            )
            setFormSubmitted(true)
          }}
        />
      )}
    </div>
  )
}
