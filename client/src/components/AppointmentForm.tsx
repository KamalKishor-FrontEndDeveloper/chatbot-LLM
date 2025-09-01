"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"

interface AppointmentFormProps {
  onSubmit: (appointmentData: AppointmentData) => void
  onCancel: () => void
  isSubmitting?: boolean
  initialData?: Partial<AppointmentData>
  className?: string
  variant?: "chat" | "default"
}

interface AppointmentData {
  name: string
  email: string
  phone: string
  date: string
  service: string
  message: string
  preferredDoctor?: string
  time?: string
  consent?: boolean
}

export default function AppointmentForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialData,
  className,
  variant = "chat",
}: AppointmentFormProps) {
  const [formData, setFormData] = useState<AppointmentData>({
    name: "",
    email: "",
    phone: "",
    date: "",
    service: "",
    message: "",
  })

  React.useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({ ...prev, ...initialData }))
    }
  }, [initialData])

  const [errors, setErrors] = useState<Partial<AppointmentData>>({})

  const validateForm = (): boolean => {
    const newErrors: Partial<AppointmentData> = {}

    if (!formData.name.trim()) newErrors.name = "Name is required"
    if (!formData.email.trim()) newErrors.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Invalid email format"

    if (!formData.phone.trim()) newErrors.phone = "Phone number is required"
    else if (!/^\d{10,}$/.test(formData.phone.replace(/\D/g, ""))) newErrors.phone = "Invalid phone number"

    if (!formData.date.trim()) newErrors.date = "Date is required"
    if (!formData.service.trim()) newErrors.service = "Service type is required"
    if (!formData.time || !formData.time.trim()) newErrors.time = "Preferred time is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  const handleInputChange = (field: keyof AppointmentData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value as any }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  // Get tomorrow's date as minimum date
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split("T")[0]

  // Generate basic time slots (09:00 - 17:00, 30-minute intervals)
  const generateTimeSlots = () => {
    const slots: string[] = []
    const start = 9 * 60 // minutes
    const end = 17 * 60
    for (let m = start; m <= end; m += 30) {
      const hh = Math.floor(m / 60)
        .toString()
        .padStart(2, "0")
      const mm = (m % 60).toString().padStart(2, "0")
      slots.push(`${hh}:${mm}`)
    }
    return slots
  }
  const timeSlots = generateTimeSlots()

  const suggestedServices = ["Consultation", "Hair Transplant", "Hydrafacial", "Acne Treatment", "Dermal Fillers"]

  const isChat = variant === "chat"
  const containerClass = isChat
    ? "rounded-2xl border border-border/50 bg-background shadow-none p-3 sm:p-4"
    : "rounded-xl border bg-background shadow-sm p-4"

  const labelClass = "text-xs font-medium text-muted-foreground"
  const inputClassBase = "h-9 text-sm"
  const errorTextClass = "text-xs text-red-600"
  const rowGap = "space-y-3"

  return (
    <Card className={`w-full max-w-md mx-auto ${containerClass} ${className || ""}`}>
      <CardContent className="p-0">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground text-balance">Book appointment</h3>
            <p className="text-xs text-muted-foreground">We’ll confirm by SMS or email</p>
          </div>
          {/* small brand marker dot - stays within neutrals/primary palette */}
          <div className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className={rowGap}>
            <Label htmlFor="name" className={labelClass}>
              Full name <span className="sr-only">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter your full name"
              className={`${inputClassBase} ${errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p id="name-error" className={errorTextClass}>
                {errors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div className={rowGap}>
            <Label htmlFor="email" className={labelClass}>
              Email address <span className="sr-only">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="you@example.com"
              className={`${inputClassBase} ${errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              inputMode="email"
              autoComplete="email"
            />
            {errors.email && (
              <p id="email-error" className={errorTextClass}>
                {errors.email}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className={rowGap}>
            <Label htmlFor="phone" className={labelClass}>
              Phone number <span className="sr-only">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              placeholder="9876543210"
              className={`${inputClassBase} ${errors.phone ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : "phone-help"}
              inputMode="tel"
              autoComplete="tel"
            />
            {!errors.phone && (
              <p id="phone-help" className="text-[11px] leading-4 text-muted-foreground">
                Numbers only, 10+ digits
              </p>
            )}
            {errors.phone && (
              <p id="phone-error" className={errorTextClass}>
                {errors.phone}
              </p>
            )}
          </div>

          {/* Date */}
          <div className={rowGap}>
            <Label htmlFor="date" className={labelClass}>
              Preferred date <span className="sr-only">*</span>
            </Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange("date", e.target.value)}
              min={minDate}
              className={`${inputClassBase} ${errors.date ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              aria-invalid={!!errors.date}
              aria-describedby={errors.date ? "date-error" : undefined}
            />
            {errors.date && (
              <p id="date-error" className={errorTextClass}>
                {errors.date}
              </p>
            )}
          </div>

          {/* Service */}
          <div className={rowGap}>
            <Label htmlFor="service" className={labelClass}>
              Service type <span className="sr-only">*</span>
            </Label>
            <Input
              id="service"
              type="text"
              value={formData.service}
              onChange={(e) => handleInputChange("service", e.target.value)}
              placeholder="e.g., Hair Transplant, Consultation"
              list="service-suggestions"
              className={`${inputClassBase} ${errors.service ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              aria-invalid={!!errors.service}
              aria-describedby={errors.service ? "service-error" : "service-help"}
            />
            <datalist id="service-suggestions">
              {suggestedServices.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {!errors.service && (
              <p id="service-help" className="text-[11px] leading-4 text-muted-foreground">
                Quick picks below
              </p>
            )}
            {errors.service && (
              <p id="service-error" className={errorTextClass}>
                {errors.service}
              </p>
            )}

            <div className="mt-1.5 flex flex-wrap gap-2">
              {suggestedServices.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleInputChange("service", s)}
                  className="text-xs px-2 py-1 rounded-full border border-border bg-muted hover:bg-muted/80 text-foreground/80 transition-colors"
                  aria-label={`Select service ${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Time + Doctor */}
          <div className="grid grid-cols-2 gap-3">
            <div className={rowGap}>
              <Label htmlFor="time" className={labelClass}>
                Preferred time <span className="sr-only">*</span>
              </Label>
              <select
                id="time"
                value={formData.time || ""}
                onChange={(e) => handleInputChange("time", e.target.value)}
                className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${errors.time ? "border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500" : "focus:outline-none focus:ring-2 focus:ring-blue-600"}`}
                aria-invalid={!!errors.time}
                aria-describedby={errors.time ? "time-error" : undefined}
              >
                <option value="">Select a time</option>
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
              {errors.time && (
                <p id="time-error" className={errorTextClass}>
                  {errors.time}
                </p>
              )}
            </div>

            <div className={rowGap}>
              <Label htmlFor="preferredDoctor" className={labelClass}>
                Preferred doctor (optional)
              </Label>
              <Input
                id="preferredDoctor"
                type="text"
                value={formData.preferredDoctor || ""}
                onChange={(e) => handleInputChange("preferredDoctor", e.target.value)}
                placeholder="e.g., Dr. Niti Gaur"
                className={inputClassBase}
              />
            </div>
          </div>

          {/* Message */}
          <div className={rowGap}>
            <Label htmlFor="message" className={labelClass}>
              Message (optional)
            </Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleInputChange("message", e.target.value)}
              placeholder="Any specific concerns or notes..."
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Consent */}
          <div className="flex items-start gap-2">
            <input
              id="consent"
              type="checkbox"
              checked={!!formData.consent}
              onChange={(e) => handleInputChange("consent", e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <label htmlFor="consent" className="text-xs text-foreground/90">
              I consent to be contacted by Citrine Clinic about my appointment.
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant={isChat ? "ghost" : "outline"}
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 h-9 text-sm"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 h-9 text-sm">
              {isSubmitting ? "Booking…" : "Book appointment"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
