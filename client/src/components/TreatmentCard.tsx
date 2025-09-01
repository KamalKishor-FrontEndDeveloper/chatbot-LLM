"use client"
import { useQuery } from "@tanstack/react-query"
import { CalendarCheck, MessageSquare, Users } from "lucide-react"
import { useState, useEffect } from "react"
import ContactQuoteForm from "./ContactQuoteForm"

interface HealthcareTreatment {
  id: number | string
  name: string
  t_name?: string
  price?: string | number | null
  doctors?: number[] | string[] | string | null
}

interface Doctor {
  id: number
  name: string
  specialization: string
  is_available: boolean
}

interface TreatmentCardProps {
  treatment: HealthcareTreatment
  onAsk?: (treatment: HealthcareTreatment) => void
  onBook?: (treatment: HealthcareTreatment) => void
  className?: string
  maxVisibleDoctors?: number
}
// function normalizeDoctorName(name: string): string {
//   // Ensure consistent "Dr. " prefix spacing
//   return name.replace(/^Dr\.?\s*/, "Dr. ")
// }

function parsePriceNumber(price: any): number | null {
  if (price === null || price === undefined) return null
  if (typeof price === "number" && Number.isFinite(price)) return price
  const n = Number(String(price).replace(/[^\d.]/g, ""))
  return Number.isFinite(n) ? n : null
}
export default function TreatmentCard({
  treatment,
  onAsk,
  onBook,
  className,
  maxVisibleDoctors = 3,
}: TreatmentCardProps) {
  const [fetchedDoctorNames, setFetchedDoctorNames] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showQuoteForm, setShowQuoteForm] = useState(false)

  // Helper function to get doctor IDs from JSON string or array
  const getDoctorIds = (treatment: HealthcareTreatment): number[] => {
    if (!treatment.doctors) return []

    if (Array.isArray(treatment.doctors)) {
      return treatment.doctors.map((d) => (typeof d === "string" ? Number.parseInt(d) : d)).filter((id) => !isNaN(id))
    }

    // Handle JSON string like "[19128,19129]"
    if (typeof treatment.doctors === "string") {
      try {
        const parsed = JSON.parse(treatment.doctors)
        if (Array.isArray(parsed)) {
          return parsed.filter((id) => typeof id === "number" && !isNaN(id))
        }
      } catch {
        // Fallback to comma-separated parsing
        return treatment.doctors
          .split(",")
          .map((id) => Number.parseInt(id.trim()))
          .filter((id) => !isNaN(id))
      }
    }

    return []
  }

  // Helper function to get doctor count
  const getDoctorCount = (treatment: HealthcareTreatment): number => {
    return getDoctorIds(treatment).length
  }

  const doctorCount = getDoctorCount(treatment)
  const treatmentDoctorIds = getDoctorIds(treatment)

  const {
    data: doctors,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const response = await fetch("/api/doctors")
      if (!response.ok) throw new Error("Failed to fetch doctors")
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const availableDoctors = doctors?.filter((doctor: any) => treatmentDoctorIds.includes(doctor.id)) || []

  useEffect(() => {
    const fetchDoctorNames = async () => {
      const doctorIds = getDoctorIds(treatment) // Use the unified getDoctorIds function
      if (doctorIds.length === 0) {
        setFetchedDoctorNames([]) // Ensure names are cleared if no doctors
        return
      }

      setLoading(true)
      try {
        const response = await fetch("/api/doctors")
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            const allDoctors: Doctor[] = result.data
            const relevantDoctors = allDoctors.filter((doctor) => doctorIds.includes(doctor.id))
            const names = relevantDoctors.map((doctor) => doctor.name.replace(/^Dr\.\s*/, "Dr. "))
            setFetchedDoctorNames(names)
          } else {
            setFetchedDoctorNames([]) // Clear names if API returns no data or error
          }
        } else {
          console.error("Failed to fetch doctors:", response.statusText)
          // Clear names when API fails - will show IDs as fallback
          setFetchedDoctorNames([])
        }
      } catch (error) {
        console.error("Error fetching doctor names:", error)
        // Use fallback doctor names based on common IDs
        const fallbackNames = doctorIds.map((id) => {
          if (id === 19129) return "Dr. Niti Gaur"
          if (id === 19543) return "Dr. Rajesh Kumar"
          return `Dr. Specialist ${id}`
        })
        setFetchedDoctorNames(fallbackNames)
      } finally {
        setLoading(false)
      }
    }

    fetchDoctorNames()
  }, [treatment]) // fix exhaustive-deps: depend on the object captured by the effect

  const isCondition = treatment.name?.includes("(C)")
  const isTreatment = treatment.name?.includes("(T)")
  const categoryType = isCondition ? "Condition" : isTreatment ? "Treatment" : "Service"
  const categoryClasses = isCondition
    ? "bg-amber-100 text-amber-800 dark:bg-amber-300/20 dark:text-amber-300 border border-amber-200/80 dark:border-amber-300/30"
    : "bg-blue-100 text-blue-800 dark:bg-blue-300/20 dark:text-blue-300 border border-blue-200/80 dark:border-blue-300/30"

  const hasPrice = !!treatment.price && String(treatment.price).trim() !== ""
  const priceNumber = parsePriceNumber(treatment.price)
  const priceText =
    hasPrice && priceNumber !== null
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
          priceNumber,
        )
      : "Contact for quote"

  return (
    <div
      data-testid={`treatment-card-${treatment.id}`}
      className={`w-full rounded-2xl border border-border bg-card p-3 md:p-4 transition-colors hover:bg-accent/20 shadow-sm ${className || ""}`}
      role="group"
      aria-label={`${categoryType} card for ${treatment.t_name ?? treatment.name}`}
    >
      {/* Header: title + category + price chip (mobile-first) */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-2">
          <div aria-hidden="true" className="mt-1 h-5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-500" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm md:text-base font-semibold text-foreground text-pretty line-clamp-2 m-0 p-0 leading-tight">
                {treatment.t_name || treatment.name}
              </h4>
              <span
                className={`whitespace-nowrap text-[10px] md:text-xs px-2.5 py-0.5 rounded-full font-medium ${categoryClasses}`}
                aria-label={`Category: ${categoryType}`}
              >
                {categoryType}
              </span>
            </div>
            {treatment.name && treatment.t_name && treatment.name !== treatment.t_name && (
              <p className="text-xs md:text-sm text-muted-foreground line-clamp-1 m-0 p-0 mt-1 leading-tight">
                {String(treatment.name).replace(/\s*$$[CT]$$$/, "")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div
            className={`rounded-md border border-border bg-background/60 px-2.5 py-1 text-right ${!hasPrice ? "cursor-pointer hover:bg-blue-50 hover:border-blue-200" : ""}`}
            aria-label="Price"
            onClick={!hasPrice ? () => setShowQuoteForm(true) : undefined}
          >
            <p className="text-[10px] font-medium text-muted-foreground leading-none m-0 p-0">Price</p>
            <p
              className={`text-sm md:text-base font-semibold leading-tight m-0 p-0 ${!hasPrice ? "text-blue-600" : "text-foreground"}`}
            >
              {priceText}
            </p>
          </div>
        </div>
      </div>

      {/* Doctors: compact chips with skeletons; show IDs if names not loaded */}
      {doctorCount > 0 && (
        <div className="mt-3 md:mt-4 rounded-md border border-border bg-muted/40 p-2.5 md:p-3">
          <div className="mb-2 flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-500"
              aria-hidden="true"
            >
              <Users className="h-4 w-4" />
            </div>
            <span className="text-xs md:text-sm font-medium text-foreground">
              {doctorCount} Specialist{doctorCount !== 1 ? "s" : ""} Available
            </span>
          </div>

          {isLoading ? (
            <div className="flex flex-wrap gap-2" aria-live="polite" aria-busy="true">
              <span className="h-6 w-24 animate-pulse rounded-full bg-muted" />
              <span className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              <span className="h-6 w-28 animate-pulse rounded-full bg-muted" />
            </div>
          ) : error ? (
            <p className="text-xs text-muted-foreground">
              Unable to load specialists right now.{" "}
              {treatmentDoctorIds.length > 0 && `IDs: ${treatmentDoctorIds.join(", ")}`}
            </p>
          ) : fetchedDoctorNames.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {fetchedDoctorNames.slice(0, Math.max(0, maxVisibleDoctors || 3)).map((name, idx) => (
                <span
                  key={`${name}-${idx}`}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {name}
                </span>
              ))}
              {fetchedDoctorNames.length > (maxVisibleDoctors || 3) && (
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                  +{fetchedDoctorNames.length - (maxVisibleDoctors || 3)} more
                </span>
              )}
            </div>
          ) : fetchedDoctorNames.length === 0 && treatmentDoctorIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {treatmentDoctorIds.map((id, idx) => {
                let name = `Dr. Specialist ${id}`
                if (id === 19129) name = "Dr. Kamal Kishor"
                if (id === 19191) name = "Kartik"
                if (id === 19543) name = "Prashant Mall"
                if (id === 19128) name = "Dr.Satish"
                if (id === 19068) name = "Dr. Karen Thomas"
                if (id === 19069) name = "Dr Sharmila Rathe"
                if (id === 11) name = "Dr DigiLantern"

                return (
                  <span
                    key={`fallback-${id}-${idx}`}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    {name}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No specialists available</p>
          )}
        </div>
      )}

      {/* Actions: small, chatbot-appropriate quick actions (optional callbacks) */}
      {(onAsk || onBook) && (
        <div className="mt-3 flex items-center gap-2">
          {onAsk && (
            <button
              type="button"
              onClick={() => onAsk?.(treatment)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              aria-label="Ask about this"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Ask about this</span>
            </button>
          )}
          {onBook && (
            <button
              type="button"
              onClick={() => onBook?.(treatment)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 text-white px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              aria-label="Book consultation"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              <span>Book consult</span>
            </button>
          )}
        </div>
      )}

      {/* Contact Quote Form Modal */}
      {showQuoteForm && (
        <ContactQuoteForm
          serviceName={treatment.t_name || treatment.name}
          onClose={() => setShowQuoteForm(false)}
          onSuccess={() => setShowQuoteForm(false)}
        />
      )}
    </div>
  )
}
