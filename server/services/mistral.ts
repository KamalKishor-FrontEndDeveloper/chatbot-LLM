import { Mistral } from '@mistralai/mistralai';
import { HealthcareTreatment } from '@shared/schema';
import { healthcareApi } from './healthcare-api';
import { tavilyService } from './tavily';
import { citrineContentService } from './citrine-content';
import { sanitizeForLog, sanitizeForOutput } from '../utils/sanitizer';

interface AppointmentBooking {
  name: string;
  email: string;
  phone: string;
  date: string;
  service: string;
  message: string;
  clinic_location_id: number;
  app_source: string;
}

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY || '6apvdYw6attdCoWv0GuiSfaRZlfTGjt7',
});

export interface ChatResponse {
  message: string;
  treatments?: HealthcareTreatment[];
  intent?: string;
  appointmentContext?: {
    suggestedService?: string;
    suggestedDoctors?: string[];
  };
}

export class MistralService {
  async processHealthcareQuery(userMessage: string): Promise<ChatResponse> {
    try {
      console.log(`Processing query: "${sanitizeForLog(userMessage)}"`);
      
      // First, analyze the user's intent
      const intent = await this.analyzeIntent(userMessage);
      console.log(`Intent detected: ${intent}`);
      
      // Get all data sources
      const [citrineContext, tavilyContext] = await Promise.all([
        citrineContentService.getCitrineContent(),
        this.getTavilyContext(userMessage, intent)
      ]);
      
      console.log(`Data sources loaded - MD: ${citrineContext ? 'Yes' : 'No'}, Tavily: ${tavilyContext ? 'Yes' : 'No'}`);

      // Handle off-topic questions with guard rails
      if (intent === 'off_topic') {
        return {
          message: "I'm HealthLantern AI, your healthcare assistant. I'm here to help you with medical treatments, costs, doctor availability, and health-related questions.\n\nI can help you with:\n• Treatment information and pricing\n• Doctor availability and specializations\n• Healthcare consultations\n• Medical conditions and their treatments\n\nWhat healthcare question can I assist you with today?",
          intent: 'off_topic',
        };
      }

      // Get relevant treatments based on the query
      const treatments = await this.getRelevantTreatments(userMessage, intent);

      // Combine all contexts
      const combinedContext = this.combineContexts(citrineContext, tavilyContext);
      console.log(`Combined context length: ${combinedContext.length} characters`);
      
      // Generate a contextual response
      const response = await this.generateResponse(userMessage, treatments, intent, combinedContext);

      // For specific queries, only show the specific treatment requested
      const isSpecificQuery = this.isSpecificCostQuery(userMessage) || intent === 'specific_treatment';

      let finalTreatments: HealthcareTreatment[] | undefined;
      if (isSpecificQuery) {
        // For specific queries, only return exact match
        finalTreatments = treatments.length > 0 ? [treatments[0]] : undefined;
      } else if (intent === 'treatment_selection') {
        // For treatment selection, don't show treatment cards
        finalTreatments = undefined;
      } else if (intent === 'doctor_inquiry') {
        // For doctor inquiries, don't show treatment cards unless asking who performs
        const isPerformQuery = userMessage.toLowerCase().includes('perform') || userMessage.toLowerCase().includes('who does');
        finalTreatments = isPerformQuery ? treatments.slice(0, 1) : undefined;
      } else {
        // For general queries, only show if we have exact matches
        const priceLimit = this.extractPriceLimit(userMessage);
        const isSpecificPriceQuery = intent === 'cost_inquiry' && priceLimit !== null;
        
        // Don't show treatment cards for general medical questions
        if (intent === 'general_info' || intent === 'other') {
          finalTreatments = undefined;
        } else {
          const shouldShowTreatments = (isSpecificPriceQuery && treatments.length === 0) ? false : treatments.length > 0;
          finalTreatments = shouldShowTreatments ? treatments.slice(0, 3) : undefined;
        }
      }

      // Enhance treatments with doctor names before sending to frontend
      let enhancedTreatments: HealthcareTreatment[] | undefined;
      if (finalTreatments && finalTreatments.length > 0) {
        enhancedTreatments = await Promise.all(
          finalTreatments.map(async (treatment) => {
            const doctorIds = healthcareApi.getDoctorIds(treatment);
            if (doctorIds.length > 0) {
              const doctors = await healthcareApi.getDoctorsByIds(doctorIds);
              return {
                ...treatment,
                doctorNames: doctors.map(d => d.name.replace(/^Dr\.\s*/, '')),
                doctorCount: doctors.length
              };
            }
            return treatment;
          })
        );
      }

      return {
        message: response,
        treatments: enhancedTreatments,
        intent,
      };
    } catch (error) {
      console.error('Mistral Service Error:', error);
      return {
        message: "I'm sorry, I'm having trouble processing your request right now. Please try again later.",
        intent: 'error',
      };
    }
  }

  private async analyzeIntent(userMessage: string): Promise<string> {
    // First, check for obvious off-topic keywords
    const offTopicKeywords = [
      'capital', 'country', 'geography', 'sports', 'weather', 'politics', 
      'entertainment', 'movie', 'celebrity', 'music', 'technology', 'programming',
      'travel', 'food recipe', 'cooking', 'history', 'science fiction', 'math problem'
    ];

    const lowerMessage = userMessage.toLowerCase();
    const hasOffTopicKeywords = offTopicKeywords.some(keyword => lowerMessage.includes(keyword));

    if (hasOffTopicKeywords) {
      console.log(`Off-topic detected via keywords: "${sanitizeForLog(userMessage)}"`);
      return 'off_topic';
    }

    // Check for doctor inquiry keywords first (higher priority)
    const doctorInquiryKeywords = [
      'doctor', 'dr ', 'dr.', 'specialist', 'physician', 'about dr', 'know about dr', 'niti gaur', 'dr niti', 'who is niti'
    ];

    const hasDoctorInquiry = doctorInquiryKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    if (hasDoctorInquiry) {
      console.log(`Doctor inquiry intent detected: "${sanitizeForLog(userMessage)}"`);
      return 'doctor_inquiry';
    }

    // Check for appointment booking keywords (higher priority)
    const appointmentKeywords = [
      'book appointment', 'schedule appointment', 'book consultation', 'schedule consultation',
      'proceed with booking', 'how to book', 'next step to book', 'appointment with'
    ];

    const hasAppointmentIntent = appointmentKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    // Check for simple "yes" after doctor recommendation
    if (lowerMessage === 'yes' || lowerMessage === 'yeah' || lowerMessage === 'ok') {
      console.log(`Appointment confirmation detected: "${sanitizeForLog(userMessage)}"`);
      return 'appointment_booking';
    }

    if (hasAppointmentIntent) {
      console.log(`Appointment booking intent detected: "${sanitizeForLog(userMessage)}"`);
      return 'appointment_booking';
    }

    // Check for specific patterns first
    // Service list patterns - check first
    const serviceListPatterns = [
      'complete list of services', 'all services', 'list of services', 'show all services',
      'what services do you offer', 'services available', 'all treatments available',
      'complete treatment list', 'show all treatments', 'list all treatments'
    ];

    if (serviceListPatterns.some(pattern => lowerMessage.includes(pattern))) {
      console.log(`Service list request detected: "${sanitizeForLog(userMessage)}"`);
      return 'treatment_list';
    }

    // Treatment selection patterns
    const treatmentSelectionPattern = /^(treatment\s*)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth)$/i;
    const commonTreatments = [
      'acne', 'laser hair removal', 'botox', 'fillers', 'prp', 'hydrafacial', 
      'chemical peel', 'microneedling', 'body contouring', 'stretch marks'
    ];

    if (treatmentSelectionPattern.test(userMessage) && 
        commonTreatments.some(treatment => lowerMessage.includes(treatment.replace(/\s+/g, '')) || treatment.includes(lowerMessage))) {
      console.log(`Treatment selection detected: "${sanitizeForLog(userMessage)}"`);
      return 'treatment_selection';
    }

    const response = await mistral.chat.complete({
      model: "mistral-large-latest",
      messages: [
        {
          role: "system",
          content: `You are a strict healthcare intent classifier. Be very careful to classify non-medical questions as "off_topic".

          Respond with JSON in this format: {"intent": "category"}

          Healthcare intents (ONLY for medical/health questions):
          - "cost_inquiry" - asking about medical treatment costs/prices
          - "treatment_list" - wanting to see available medical treatments
          - "doctor_inquiry" - asking about doctors, doctor information, doctor availability, "about dr", "know about doctor"
          - "specific_treatment" - asking about a specific medical treatment
          - "comparison" - comparing medical treatments or services
          - "appointment_booking" - explicitly wanting to book/schedule an appointment (must contain booking words)
          - "clinic_info" - asking about clinic details, address, hours, services
          - "general_info" - general healthcare/medical questions not related to clinic services
          - "other" - other healthcare related topics not available at clinic

          NON-healthcare intent (use for ALL non-medical questions):
          - "off_topic" - geography, capitals, sports, entertainment, technology, politics, weather, general knowledge, cooking, travel, or ANY topic NOT related to healthcare OR Citrine Clinic

          Examples:
          - "What is the capital of India?" -> {"intent": "off_topic"}
          - "Who won the World Cup?" -> {"intent": "off_topic"}
          - "What's the weather today?" -> {"intent": "off_topic"}
          - "Who is Dr. Niti Gaur?" -> {"intent": "doctor_inquiry"}
          - "Tell me about Citrine Clinic" -> {"intent": "clinic_info"}
          - "Cost of dental treatment?" -> {"intent": "cost_inquiry"}
          - "Show me heart treatments" -> {"intent": "treatment_list"}
          - "Which doctors are available?" -> {"intent": "doctor_inquiry"}
          - "Book an appointment" -> {"intent": "appointment_booking"}
          - "What is your clinic address?" -> {"intent": "clinic_info"}
          - "What is acne?" -> {"intent": "general_info"}`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      responseFormat: { type: "json_object" },
    });

    try {
      const rawContent: any = response.choices?.[0]?.message?.content;
      let contentStr: string;

      if (typeof rawContent === 'string') {
        contentStr = rawContent;
      } else if (Array.isArray(rawContent)) {
        // Join array chunks into a single string; handle chunks that may be strings or objects with text/content
        contentStr = rawContent
          .map(chunk => {
            if (typeof chunk === 'string') return chunk;
            if (typeof chunk === 'object' && chunk !== null) return (chunk.text ?? chunk.content ?? JSON.stringify(chunk));
            return String(chunk);
          })
          .join('');
      } else if (typeof rawContent === 'object' && rawContent !== null) {
        // Single object chunk with possible text/content field
        contentStr = (rawContent.text ?? rawContent.content ?? JSON.stringify(rawContent));
      } else {
        contentStr = '{"intent": "other"}';
      }

      let result: any;
      try {
        result = JSON.parse(contentStr);
      } catch {
        result = { intent: 'other' };
      }

      const intent = result.intent || 'other';
      console.log(`Intent analysis for "${sanitizeForLog(userMessage)}": ${intent}`);
      return intent;
    } catch {
      console.log(`Intent analysis failed for "${sanitizeForLog(userMessage)}", defaulting to other`);
      return 'other';
    }
  }

  private async getRelevantTreatments(userMessage: string, intent: string): Promise<HealthcareTreatment[]> {
    switch (intent) {
      case 'cost_inquiry':
        console.log('Cost inquiry - searching API first');
        // Always try API first for cost inquiries
        const specificTreatment = await healthcareApi.getSpecificTreatment(userMessage);
        if (specificTreatment && specificTreatment.price) {
          console.log(`Found treatment with price in API: ${specificTreatment.t_name} - ₹${specificTreatment.price}`);
          return [specificTreatment];
        }
        
        // If no specific treatment found, try broader search in API
        const searchResults = await healthcareApi.searchTreatments(userMessage);
        const treatmentsWithPrice = searchResults.filter(t => t.price && t.price !== '');
        if (treatmentsWithPrice.length > 0) {
          console.log(`Found ${treatmentsWithPrice.length} treatments with prices in API`);
          return treatmentsWithPrice;
        }
        
        console.log('No treatments with prices found in API');
        return [];

      case 'treatment_list':
        return await healthcareApi.getAllTreatments();

      case 'specific_treatment':
        // For specific treatment queries, return only the specific treatment
        const specificTreatmentResult = await healthcareApi.getSpecificTreatment(userMessage);
        return specificTreatmentResult ? [specificTreatmentResult] : [];

      case 'comparison':
        return await healthcareApi.searchTreatments(userMessage);

      case 'doctor_inquiry':
        // Check if asking who performs a treatment
        if (userMessage.toLowerCase().includes('perform') || userMessage.toLowerCase().includes('who does')) {
          return await healthcareApi.searchTreatments(userMessage);
        }
        // For general doctor inquiries, don't return treatments
        return [];
      case 'appointment_booking':
      case 'clinic_info':
        // These intents don't need treatment data
        return [];

      case 'treatment_selection':
        // User has selected a specific treatment, get details for booking context
        const selectedTreatment = await healthcareApi.getSpecificTreatment(userMessage);
        return selectedTreatment ? [selectedTreatment] : [];

      default:
        return await healthcareApi.searchTreatments(userMessage);
    }
  }

  private isSpecificCostQuery(message: string): boolean {
    const specificIndicators = [
      'cost of', 'price of', 'how much is', 'what is the cost',
      'what does it cost', 'price for', 'cost for'
    ];
    const lowerMessage = message.toLowerCase();
    return specificIndicators.some(indicator => lowerMessage.includes(indicator));
  }

  private extractPriceLimit(message: string): number | null {
    // Look for patterns like "under ₹100", "below 500", "less than ₹1000"
    const patterns = [
      /under\s*₹?(\d+)/i,
      /below\s*₹?(\d+)/i,
      /less\s*than\s*₹?(\d+)/i,
      /maximum\s*₹?(\d+)/i,
      /max\s*₹?(\d+)/i,
      /up\s*to\s*₹?(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return null;
  }

  private async filterTreatmentsByPrice(maxPrice: number, originalMessage: string): Promise<HealthcareTreatment[]> {
    const allTreatments = await healthcareApi.getTreatmentsByPrice();
    const flatTreatments = this.flattenTreatments(allTreatments);

    const filteredTreatments = flatTreatments.filter(treatment => {
      const price = parseInt(treatment.price);
      return !isNaN(price) && price < maxPrice; // Use < instead of <= to exclude exact matches when looking for "under"
    });

    console.log(`Filtering treatments under ₹${maxPrice}: found ${filteredTreatments.length} results`);
    return filteredTreatments;
  }

  private flattenTreatments(treatments: HealthcareTreatment[]): HealthcareTreatment[] {
    const result: HealthcareTreatment[] = [];

    const flatten = (items: HealthcareTreatment[]) => {
      for (const item of items) {
        result.push(item);
        if (item.children && item.children.length > 0) {
          flatten(item.children as HealthcareTreatment[]);
        }
      }
    };

    flatten(treatments);
    return result;
  }

  private isFollowUpTreatmentQuery(message: string, treatments: HealthcareTreatment[]): boolean {
    const cleanMessage = message.trim().toLowerCase();

    // Check if it's a short message that matches a treatment name exactly
    if (cleanMessage.length < 50) {
      // Common treatment names that indicate user selection
      const commonTreatmentNames = [
        'hairfall', 'hair transplant', 'dental', 'skin', 'eye', 'heart',
        'hairfall in men', 'hairfall in women', 'hairfall treatment'
      ];

      const isExactMatch = commonTreatmentNames.some(name => 
        cleanMessage === name || cleanMessage === name.replace(/\s+/g, '')
      );

      if (isExactMatch) {
        return true;
      }

      // Check against actual treatment names
      return treatments.some(treatment => {
        const treatmentName = treatment.t_name?.toLowerCase() || '';
        return treatmentName === cleanMessage || cleanMessage === treatmentName;
      });
    }

    return false;
  }

  private getDoctorCount(treatment: HealthcareTreatment): number {
    return healthcareApi.getDoctorCount(treatment);
  }

  private getDoctorIds(treatment: HealthcareTreatment): number[] {
    return healthcareApi.getDoctorIds(treatment);
  }



  private async generateResponse(
    userMessage: string, 
    treatments: HealthcareTreatment[], 
    intent: string,
    webContext?: string
  ): Promise<string> {
    switch (intent) {
      case 'cost_inquiry':
        return await this.handleCostInquiry(userMessage, treatments);
      case 'treatment_list':
        return await this.handleTreatmentList(treatments);
      case 'specific_treatment':
        return await this.handleSpecificTreatment(userMessage, treatments);
      case 'doctor_inquiry':
        return await this.handleDoctorInquiry(userMessage, treatments);
      case 'appointment_booking':
        return await this.handleAppointmentBooking(userMessage);
      case 'clinic_info':
        return await this.handleClinicInfo(userMessage, webContext);
      case 'general_info':
      case 'other':
        return await this.handleGeneralMedicalInfo(userMessage);
      default:
        return await this.handleTreatmentResponse(userMessage, treatments, intent, webContext);
    }
  }

  private async handleDoctorInquiry(userMessage: string, treatments: HealthcareTreatment[]): Promise<string> {
    try {
      // Check if asking about Dr. Niti Gaur specifically
      if (userMessage.toLowerCase().includes('niti gaur') || userMessage.toLowerCase().includes('dr niti')) {
        return await this.getDrNitiInfoFromSources();
      }
      
      // Check if asking about a specific doctor
      const specificDoctorMatch = userMessage.match(/(?:about|tell me about)\s+(?:dr\.?\s+)?(\w+)/i);
      
      if (specificDoctorMatch) {
        const doctorName = specificDoctorMatch[1].toLowerCase();
        const allDoctors = await healthcareApi.getAllDoctors();
        const actualDoctors = allDoctors.filter(d => d.specialization === 'doctor');
        
        const specificDoctor = actualDoctors.find(d => 
          d.name.toLowerCase().includes(doctorName)
        );
        
        if (specificDoctor) {
          const cleanName = specificDoctor.name.replace(/^Dr\.\s*/, '');
          let response = `# Dr. ${cleanName}\n\n`;
          response += `**Specialization:** Medical Doctor\n`;
          response += `**Status:** ${specificDoctor.is_available ? '🟢 Available' : '🔴 Not Available'}\n\n`;
          
          // Find treatments this doctor handles
          const doctorTreatments = await this.getDoctorTreatments(specificDoctor.id);
          if (doctorTreatments.length > 0) {
            response += `**Specializes in:**\n`;
            doctorTreatments.slice(0, 5).forEach(treatment => {
              response += `• ${treatment.t_name}\n`;
            });
            if (doctorTreatments.length > 5) {
              response += `• And ${doctorTreatments.length - 5} more treatments\n`;
            }
            response += '\n';
          }
          
          response += `💡 **Ready to book with Dr. ${cleanName}?** Just let me know!`;
          return response;
        } else {
          return `I couldn't find information about Dr. ${doctorName}. Here are our available doctors:\n\n` + await this.getAllDoctorsInfo();
        }
      }
      
      // General doctor inquiry
      return await this.getAllDoctorsInfo();
    } catch (error) {
      console.error('Doctor inquiry error:', error);
      return "I'm having trouble accessing doctor information right now. Please try again later or contact our clinic directly.";
    }
  }
  
  private async getAllDoctorsInfo(): Promise<string> {
    const allDoctors = await healthcareApi.getAllDoctors();
    const actualDoctors = allDoctors.filter(d => d.specialization === 'doctor');
    
    if (actualDoctors.length === 0) {
      return "I'm sorry, I couldn't find any doctors available at the moment. Please contact our clinic directly for doctor availability.";
    }
    
    let response = `Here are our available doctors:\n\n`;
    
    actualDoctors.forEach((doctor, index) => {
      const cleanName = doctor.name.replace(/^Dr\.\s*/, '');
      response += `**${index + 1}. Dr. ${cleanName}**\n`;
      response += `   *Specialization:* Medical Doctor\n`;
      response += `   *Status:* ${doctor.is_available ? '🟢 Available' : '🔴 Not Available'}\n\n`;
    });
    
    response += `💡 *To book an appointment, just let me know which doctor you'd prefer!*`;
    return response;
  }
  
  private async getDoctorTreatments(doctorId: number): Promise<HealthcareTreatment[]> {
    const allTreatments = await healthcareApi.getAllTreatments();
    const flatTreatments = this.flattenTreatments(allTreatments);
    
    return flatTreatments.filter(treatment => {
      const doctorIds = healthcareApi.getDoctorIds(treatment);
      return doctorIds.includes(doctorId);
    });
  }

  private async handleAppointmentBooking(userMessage: string): Promise<string> {
    // Extract doctor name from message
    const doctorMatch = userMessage.match(/(?:with|dr\.?\s+)(\w+\s*\w*)/i);
    let selectedDoctor = '';
    
    if (doctorMatch) {
      selectedDoctor = doctorMatch[1].trim();
    }
    
    // Check if message contains appointment details
    const hasPersonalInfo = this.extractAppointmentInfo(userMessage);

    if (hasPersonalInfo.isComplete) {
      // Process the appointment booking
      try {
        const result = await healthcareApi.bookAppointment(hasPersonalInfo.appointmentData!);

        if (result.success) {
          return `# ✅ Appointment Booked Successfully!

**Confirmation Details:**
- **Name:** ${hasPersonalInfo.appointmentData!.name}
- **Service:** ${hasPersonalInfo.appointmentData!.service}
- **Date:** ${hasPersonalInfo.appointmentData!.date}
- **Contact:** ${hasPersonalInfo.appointmentData!.phone}

${result.message}

---

💡 **What's Next?**
- Check your email for appointment confirmation
- Our team will contact you to confirm the exact time
- Feel free to ask if you need to reschedule or have questions!`;
        } else {
          return `# ❌ Booking Failed

${result.message}

Please try again or contact our clinic directly at **9654122458** for assistance.`;
        }
      } catch (error) {
        return `# ❌ Booking Error

I encountered an issue while booking your appointment. Please contact our clinic directly at **9654122458** for immediate assistance.`;
      }
    } else {
      // If doctor name is mentioned, show personalized booking message
      if (selectedDoctor) {
        return `# 📅 Book Appointment with Dr. ${selectedDoctor}

I'll help you book an appointment with **Dr. ${selectedDoctor}**.

**To proceed, I'll need:**
• Your full name
• Email address  
• Phone number
• Preferred date (YYYY-MM-DD)
• Service/treatment needed

**You can either:**
1. Fill out the appointment form below
2. Or provide details in chat like: "Name: John, Email: john@email.com, Phone: 9876543210, Date: 2024-01-15, Service: Consultation"

---

💡 **Ready to book with Dr. ${selectedDoctor}?** Please provide your details!`;
      }
      
      // Return special marker to show form
      return `I'd be happy to help you book an appointment!\n\nTo proceed, please provide:\n\n• Your full name\n• Email address\n• Phone number\n• Preferred date (YYYY-MM-DD)\n• Service/treatment needed\n\nJust share these details in our chat and I'll help you schedule your appointment right away!`;
    }
  }

  private extractAppointmentInfo(message: string): { 
    isComplete: boolean; 
    appointmentData?: AppointmentBooking;
  } {
    const nameMatch = message.match(/(?:name[:\s]+|for\s+)([a-zA-Z\s]+)(?:,|$|\s+email)/i);
    const emailMatch = message.match(/email[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const phoneMatch = message.match(/phone[:\s]+(\d{10,})/i);
    const dateMatch = message.match(/date[:\s]+(\d{4}-\d{2}-\d{2})/i);
    const serviceMatch = message.match(/service[:\s]+([^,\n]+)/i);
    const messageMatch = message.match(/message[:\s]+([^,\n]+)/i);

    if (nameMatch && emailMatch && phoneMatch && dateMatch && serviceMatch) {
      return {
        isComplete: true,
        appointmentData: {
          name: nameMatch[1].trim(),
          email: emailMatch[1].trim(),
          phone: phoneMatch[1].trim(),
          date: dateMatch[1].trim(),
          service: serviceMatch[1].trim(),
          message: messageMatch ? messageMatch[1].trim() : 'Appointment booking via chatbot',
          clinic_location_id: 1,
          app_source: 'https://www.healthlantern.com'
        }
      };
    }

    return { isComplete: false };
  }

  private async handleTreatmentSelection(userMessage: string, treatments: HealthcareTreatment[]): Promise<string> {
    if (treatments.length === 0) {
      return "I couldn't find information about that specific treatment. Could you please be more specific or ask about available treatments?";
    }

    const treatment = treatments[0];
    let response = `# ${treatment.t_name}\n\n`;

    // Get doctor details if available
    const doctorIds = this.getDoctorIds(treatment);
    if (doctorIds.length > 0) {
      const doctors = await healthcareApi.getDoctorsByIds(doctorIds);
      if (doctors.length > 0) {
        response += `**Available Specialists:**\n`;
        doctors.forEach((doctor, index) => {
          const cleanName = doctor.name.replace(/^Dr\.\s*/, '');
          response += `${index + 1}. **Dr. ${cleanName}** - ${doctor.is_available ? '🟢 Available' : '🔴 Not Available'}\n`;
        });
        response += '\n';
      }
    }

    response += `**Treatment Information:**\n`;
    response += `- **Price:** ${treatment.price ? `₹${treatment.price}` : 'Contact for Quote'}\n`;
    response += `- **Available Doctors:** ${this.getDoctorCount(treatment)}\n\n`;

    response += `---\n\n`;
    response += `💡 **Ready to book your appointment?**\n\n`;
    response += `To proceed with booking, I'll need:\n`;
    response += `• Your full name\n`;
    response += `• Email address\n`;
    response += `• Phone number\n`;
    response += `• Preferred date (YYYY-MM-DD)\n\n`;
    response += `Just say "**book appointment**" or provide your details and I'll help you schedule your consultation!`;

    return response;
  }

  private async handleClinicInfo(userMessage: string, citrineContext?: string): Promise<string> {
    const clinicInfo = await this.getClinicInfoFromSources();
    return clinicInfo;
  }
  
  private extractServicesFromContent(content: string): string[] {
    const services = [
      'Laser Hair Reduction', 'Hydrafacial MD', 'Anti Wrinkle Injection',
      'Dermal Fillers', 'Chemical Peels', 'Microneedling', 'HIFU',
      'Exilis Elite', 'Eye Restore Therapy', 'Blood-derived Growth Factors',
      'Tattoo Removal', 'Total Clearlift', 'Acne Treatment', 'Pigmentation Treatment',
      'Hair Loss Treatment', 'Body Contouring', 'Bridal Dermatology'
    ];
    return services;
  }

  private getFallbackClinicInfo(): string {
    return `# 🏥 HealthLantern Medical Center\n\n## 📞 Contact Information\n**Phone:** +91-9654122458\n**Email:** info@healthlantern.com\n\n## 📍 Location\nHealthLantern Medical Center\nMedical District, Healthcare City\n\n## 🕒 Working Hours\nMonday - Saturday: 9:00 AM - 6:00 PM\nSunday: 10:00 AM - 4:00 PM\n\n## 🩺 Services Offered\n- Dermatology & Skin Care\n- Hair Transplant & Restoration\n- Plastic & Cosmetic Surgery\n- Dental Care\n- General Consultation\n- Preventive Health Checkups\n\n---\n\n💡 **Ready to get started?** Feel free to contact us or ask me to book an appointment!`;
  }

  private async handleGeneralMedicalInfo(userMessage: string): Promise<string> {
    try {
      const citrineContent = await healthcareApi.getCitrineWebsiteContent();
      
      const response = await mistral.chat.complete({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: `You are HealthLantern AI for Citrine Clinic. Use the following clinic information to answer questions:\n\n${citrineContent}\n\nProvide helpful, accurate responses about Citrine Clinic's services, treatments, and information. If the question is outside your scope, politely redirect to clinic services.`
          },
          {
            role: "user",
            content: userMessage
          }
        ],
      });
      
      const rawContent: any = response.choices?.[0]?.message?.content;
      let contentStr: string;
      
      if (typeof rawContent === 'string') {
        contentStr = rawContent;
      } else if (Array.isArray(rawContent)) {
        contentStr = rawContent
          .map(chunk => {
            if (typeof chunk === 'string') return chunk;
            if (typeof chunk === 'object' && chunk !== null) return (chunk.text ?? chunk.content ?? JSON.stringify(chunk));
            return String(chunk);
          })
          .join('');
      } else if (typeof rawContent === 'object' && rawContent !== null) {
        contentStr = (rawContent.text ?? rawContent.content ?? JSON.stringify(rawContent));
      } else {
        contentStr = '';
      }
      
      return contentStr || this.getFallbackResponse();
    } catch (error) {
      console.error('Error processing general medical info:', error);
      return this.getFallbackResponse();
    }
  }
  
  private async generateCitrineGreeting(citrineContext: string): Promise<string> {
    try {
      const response = await mistral.chat.complete({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: `You are HealthLantern AI for Citrine Clinic. Create a warm, personalized greeting using this clinic information:\n\n${citrineContext}\n\nInclude:\n1. Welcome to Citrine Clinic\n2. Brief about Dr. Niti Gaur\n3. Key services offered\n4. How you can help\n\nKeep it concise and welcoming.`
          },
          {
            role: "user",
            content: "Create a greeting message"
          }
        ],
      });
      
      const rawContent: any = response.choices?.[0]?.message?.content;
      return typeof rawContent === 'string' ? rawContent : this.getFallbackResponse();
    } catch (error) {
      return this.getFallbackResponse();
    }
  }

  private async getCostFromSources(userMessage: string, treatments: HealthcareTreatment[]): Promise<{found: boolean, price: string, treatmentName: string, source: string}> {
    // 1. Try API first
    if (treatments.length > 0 && treatments[0].price) {
      return {
        found: true,
        price: treatments[0].price,
        treatmentName: treatments[0].t_name || 'Treatment',
        source: 'Healthcare API'
      };
    }
    
    // 2. Try Tavily website
    try {
      const tavilyContent = await tavilyService.crawlWebsite('https://www.citrineclinic.com/');
      const priceFromWebsite = this.extractPriceFromContent(userMessage, tavilyContent.content);
      if (priceFromWebsite) {
        return {
          found: true,
          price: priceFromWebsite.price,
          treatmentName: priceFromWebsite.treatment,
          source: 'Citrine Website'
        };
      }
    } catch (error) {
      console.log('Tavily price lookup failed:', error);
    }
    
    // 3. Try MD file
    try {
      const mdContent = await citrineContentService.getCitrineContent();
      const priceFromMD = this.extractPriceFromContent(userMessage, mdContent);
      if (priceFromMD) {
        return {
          found: true,
          price: priceFromMD.price,
          treatmentName: priceFromMD.treatment,
          source: 'Clinic Data'
        };
      }
    } catch (error) {
      console.log('MD file price lookup failed:', error);
    }
    
    return { found: false, price: '', treatmentName: '', source: '' };
  }
  
  private extractPriceFromContent(query: string, content: string): {price: string, treatment: string} | null {
    // Simple price extraction - can be enhanced
    const priceRegex = /₹\s*(\d+(?:,\d+)*)/g;
    const matches = content.match(priceRegex);
    
    if (matches && matches.length > 0) {
      return {
        price: matches[0].replace('₹', '').trim(),
        treatment: query.replace(/cost|price|of|what|is|the/gi, '').trim()
      };
    }
    
    return null;
  }

  private getFallbackResponse(): string {
    return `I'm HealthLantern AI, focused on helping you with Citrine Clinic's services and treatments. For general medical information, I recommend consulting with our doctors or reliable medical resources.\n\nI can help you with:\n• Our available treatments and their costs\n• Doctor availability and appointments\n• Clinic information and services\n\nWould you like to know about any of our specific treatments or book a consultation with our doctors?`;
  }

  private async handleTreatmentResponse(
    userMessage: string, 
    treatments: HealthcareTreatment[], 
    intent: string,
    webContext?: string
  ): Promise<string> {
    // Check if user is showing interest in a specific treatment (single word treatments like "Hairfall", "Hair Transplant")
    const isFollowUpTreatmentQuery = this.isFollowUpTreatmentQuery(userMessage, treatments);

    if (isFollowUpTreatmentQuery) {
      const matchedTreatment = treatments.find(t => 
        t.t_name?.toLowerCase().includes(userMessage.toLowerCase()) ||
        userMessage.toLowerCase().includes(t.t_name?.toLowerCase() || '')
      );

      if (matchedTreatment) {
        let response = `# ${matchedTreatment.t_name}\n\n`;

        // Get doctor details if available
        const doctorIds = this.getDoctorIds(matchedTreatment);
        if (doctorIds.length > 0) {
          const doctors = await healthcareApi.getDoctorsByIds(doctorIds);
          if (doctors.length > 0) {
            response += `**Available Specialists:**\n`;
            doctors.forEach((doctor, index) => {
              const cleanName = doctor.name.replace(/^Dr\.\s*/, '');
              response += `${index + 1}. **Dr. ${cleanName}** - ${doctor.is_available ? '🟢 Available' : '🔴 Not Available'}\n`;
            });
            response += '\n';
          }
        }

        response += `**Treatment Information:**\n`;
        response += `- **Price:** ${matchedTreatment.price ? `₹${matchedTreatment.price}` : 'Contact for Quote'}\n`;
        response += `- **Available Doctors:** ${this.getDoctorCount(matchedTreatment)}\n\n`;

        response += `---\n\n`;
        response += `💡 **Ready to proceed?** I can help you:\n`;
        response += `• **Book an appointment** - Just say "book appointment"\n`;
        response += `• **Get more details** about this treatment\n`;
        response += `• **Compare prices** with other treatments\n`;
        response += `• **Check specific doctor availability**\n\n`;
        response += `What would you like to do next?`;

        return response;
      }
    }

    // Check if this is a price inquiry with specific criteria
    const priceLimit = this.extractPriceLimit(userMessage);
    const isSpecificPriceQuery = intent === 'cost_inquiry' && priceLimit !== null;

    let treatmentContext: string;
    if (treatments.length > 0) {
      treatmentContext = `Available treatments matching criteria: ${JSON.stringify(treatments.slice(0, 5))}`;
    } else if (isSpecificPriceQuery) {
      treatmentContext = `No treatments found within the specified price range of ₹${priceLimit}. User asked for treatments under ₹${priceLimit}.`;
    } else {
      treatmentContext = 'No specific treatments found.';
    }

    // Special handling for greetings and off-topic messages
    let systemContent = `You are HealthLantern AI, a helpful healthcare assistant. You have access to treatment data from a healthcare system.

          Guidelines:
          - Be professional, empathetic, and informative
          - Use proper Markdown formatting with clear line breaks and bullet points when listing information
          - For greetings and introductions, use proper paragraph breaks and bullet points for lists
          - If no treatments match specific price criteria, politely explain this and suggest alternatives (higher budget ranges)
          - If treatments are provided, reference them in your response
          - For cost inquiries with no results, suggest the closest available options or alternative budget ranges
          - For treatment lists, summarize what's available in an organized way
          - Always encourage users to consult with healthcare professionals for medical advice
          - Keep responses concise but informative and well-formatted with proper line breaks
          - Use a warm, helpful tone
          - When suggesting alternatives, be specific about price ranges (e.g., "under ₹500" or "under ₹1000")
          - For greeting messages, format your introduction properly with line breaks between sentences and use bullet points for capabilities

          Treatment data format:
          - id: unique identifier
          - t_name: treatment name
          - name: full name with category indicator (C) for condition, (T) for treatment
          - price: cost (empty if not available)
          - doctors: available doctors (can be IDs or names)

          ${treatmentContext}
          
          Citrine Clinic Website Information: ${webContext || ''}`

    if (intent === 'off_topic' && (userMessage.toLowerCase().includes('hi') || userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hey'))) {
      // Use Citrine content for personalized greeting
      const citrineGreeting = await this.generateCitrineGreeting(citrineContext);
      return citrineGreeting;
    }

    const response = await mistral.chat.complete({
      model: "mistral-large-latest",
      messages: [
        {
          role: "system",
          content: systemContent
        },
        {
          role: "user",
          content: userMessage
        }
      ],
    });

    // Normalize the content to a string (handle string, array of chunks, or object)
    const rawContent: any = response.choices?.[0]?.message?.content;
    let contentStr: string;

    if (typeof rawContent === 'string') {
      contentStr = rawContent;
    } else if (Array.isArray(rawContent)) {
      contentStr = rawContent
        .map(chunk => {
          if (typeof chunk === 'string') return chunk;
          if (typeof chunk === 'object' && chunk !== null) return (chunk.text ?? chunk.content ?? JSON.stringify(chunk));
          return String(chunk);
        })
        .join('');
    } else if (typeof rawContent === 'object' && rawContent !== null) {
      contentStr = (rawContent.text ?? rawContent.content ?? JSON.stringify(rawContent));
    } else {
      contentStr = '';
    }

    return contentStr || "I'd be happy to help you with information about our healthcare treatments and services.";
  }

  private async handleCostInquiry(userMessage: string, treatments: HealthcareTreatment[]): Promise<string> {
    // Try to get cost from multiple sources in order: API -> Website -> MD file
    const cost = await this.getCostFromSources(userMessage, treatments);
    
    if (!cost.found) {
      return "I couldn't find pricing information for that treatment. Could you please specify which treatment you're interested in?";
    }

    let response = `The cost of **${cost.treatmentName}** treatment at our clinic is **₹${cost.price}**.\n\n`;
    response += `*Source: ${cost.source}*\n\n`;

    // Get doctor information
    const doctorIds = this.getDoctorIds(treatments[0]);
    console.log('Doctor IDs found:', doctorIds);
    
    if (doctorIds.length > 0) {
      try {
        const doctors = await healthcareApi.getDoctorsByIds(doctorIds);
        console.log('Fetched doctors:', doctors);
        
        if (doctors && doctors.length > 0) {
          if (doctors.length === 1) {
            const doctorName = doctors[0].name.replace(/^Dr\.\s*/, '');
            response += `**Specialist:** Dr. ${doctorName}\n\n`;
          } else {
            response += `**Available Specialists:**\n`;
            doctors.forEach((doctor, index) => {
              const doctorName = doctor.name.replace(/^Dr\.\s*/, '');
              response += `${index + 1}. Dr. ${doctorName}\n`;
            });
            response += '\n';
          }
        } else {
          // Show doctor ID as fallback
          response += `**Specialist:** Dr. ${doctorIds[0]} (ID: ${doctorIds[0]})\n\n`;
        }
      } catch (error) {
        console.error('Error fetching doctor details:', error);
        response += `**Specialist:** Dr. ${doctorIds[0]} (ID: ${doctorIds[0]})\n\n`;
      }
    }

    response += `**Note:** Our experienced specialists will provide personalized consultation to ensure the best results for you.\n\n`;
    response += `Would you like to book a consultation or learn more about this procedure?`;

    return response;
  }

  private async handleSpecificTreatment(userMessage: string, treatments: HealthcareTreatment[]): Promise<string> {
    if (treatments.length === 0) {
      return "I couldn't find information about that specific treatment. Could you please be more specific or ask about available treatments?";
    }

    const treatment = treatments[0];
    let response = `# ${treatment.t_name}\n\n`;

    // Get doctor details if available
    const doctorIds = this.getDoctorIds(treatment);
    if (doctorIds.length > 0) {
      try {
        const allDoctors = await healthcareApi.getDoctorsByIds(doctorIds);
        console.log('Fetched doctors:', allDoctors);
        const doctors = allDoctors.filter(d => d.specialization === 'doctor');
        if (doctors.length > 0) {
          response += `**Available Specialists:**\n`;
          doctors.forEach((doctor, index) => {
            const cleanName = doctor.name.replace(/^Dr\.\s*/, '');
            response += `${index + 1}. **Dr. ${cleanName}** - ${doctor.is_available ? '🟢 Available' : '🔴 Not Available'}\n`;
          });
          response += '\n';
        }
      } catch (error) {
        console.error('Error fetching doctor details:', error);
        response += `**Available Doctors:** ${doctorIds.length} doctor(s) (contact clinic for details)\n\n`;
      }
    }

    response += `**Treatment Information:**\n`;
    response += `- **Price:** ${treatment.price ? `₹${treatment.price}` : 'Contact for Quote'}\n`;
    response += `- **Available Doctors:** ${this.getDoctorCount(treatment)}\n\n`;

    response += `---\n\n`;
    response += `💡 **Ready to proceed?** I can help you:\n`;
    response += `• **Book an appointment** - Just say "book appointment"\n`;
    response += `• **Get more details** about this treatment\n`;
    response += `• **Compare prices** with other treatments\n`;
    response += `• **Check specific doctor availability**\n\n`;
    response += `What would you like to do next?`;

    return response;
  }

  private async handleTreatmentList(treatments: HealthcareTreatment[]): Promise<string> {
    if (treatments.length === 0) {
      return "I'm sorry, I couldn't find any treatments available at the moment. Please contact our clinic for more information.";
    }

    const flatTreatments = this.flattenTreatments(treatments);

    let response = "# Complete List of Healthcare Services\n\n";
    response += `We offer **${flatTreatments.length}** different treatments and services:\n\n`;

    // Group treatments by type/category for better organization
    const conditions = flatTreatments.filter(t => t.name.includes('(C)'));
    const treatmentServices = flatTreatments.filter(t => t.name.includes('(T)'));

    if (conditions.length > 0) {
      response += "## Medical Conditions We Treat:\n";
      conditions.forEach((treatment, index) => {
        const cleanName = treatment.t_name || treatment.name.replace(' (C)', '');
        const price = treatment.price ? `₹${treatment.price}` : 'Contact for Quote';
        response += `${index + 1}. **${cleanName}** - ${price}\n`;
      });
      response += "\n";
    }

    if (treatmentServices.length > 0) {
      response += "## Treatment Services:\n";
      treatmentServices.forEach((treatment, index) => {
        const cleanName = treatment.t_name || treatment.name.replace(' (T)', '');
        const price = treatment.price ? `₹${treatment.price}` : 'Contact for Quote';
        response += `${index + 1}. **${cleanName}** - ${price}\n`;
      });
    }

    response += "\n---\n\n";
    response += "💡 **Need more details?** Ask about any specific treatment or condition!\n\n";
    response += "📞 **Ready to book?** Just say \"book appointment\" and I'll help you schedule a consultation.";

    return response;
  }
  
  private async getTavilyContext(userMessage: string, intent: string): Promise<string> {
    // Use Tavily for specific cases
    if (intent === 'doctor_inquiry' && userMessage.toLowerCase().includes('niti')) {
      try {
        const tavilyContent = await tavilyService.crawlWebsite('https://www.citrineclinic.com/');
        console.log('Tavily content fetched for Dr. Niti inquiry');
        return tavilyContent.content;
      } catch (error) {
        console.error('Tavily fetch failed:', error);
        return '';
      }
    }
    return '';
  }
  
  private combineContexts(citrineContext: string, tavilyContext: string): string {
    let combined = citrineContext;
    if (tavilyContext && tavilyContext !== citrineContext) {
      combined += '\n\n--- Live Website Data ---\n' + tavilyContext;
    }
    return combined;
  }
  
  private async getDrNitiInfoFromSources(): Promise<string> {
    // 1. Try API first
    try {
      const doctors = await healthcareApi.getAllDoctors();
      const drNiti = doctors.find(d => d.name.toLowerCase().includes('niti'));
      if (drNiti) {
        console.log('Dr. Niti info found in API');
        return this.formatDrNitiFromAPI(drNiti);
      }
    } catch (error) {
      console.log('API lookup for Dr. Niti failed:', error);
    }
    
    // 2. Try MD file
    try {
      const mdContent = await citrineContentService.getCitrineContent();
      if (mdContent.toLowerCase().includes('niti gaur')) {
        console.log('Dr. Niti info found in MD file');
        return this.extractDrNitiFromContent(mdContent, 'Clinic Data');
      }
    } catch (error) {
      console.log('MD file lookup for Dr. Niti failed:', error);
    }
    
    // 3. Try Tavily last
    try {
      const tavilyContent = await tavilyService.crawlWebsite('https://www.citrineclinic.com/');
      console.log('Dr. Niti info fetched from Tavily');
      return this.extractDrNitiFromContent(tavilyContent.content, 'Citrine Website');
    } catch (error) {
      console.log('Tavily lookup for Dr. Niti failed:', error);
    }
    
    return this.getFallbackDrNitiInfo();
  }
  
  private async getClinicInfoFromSources(): Promise<string> {
    // 1. Try API first
    try {
      const clinicInfo = await healthcareApi.getClinicInfo();
      if (clinicInfo) {
        console.log('Clinic info found in API');
        return this.formatClinicFromAPI(clinicInfo);
      }
    } catch (error) {
      console.log('API lookup for clinic info failed:', error);
    }
    
    // 2. Try MD file
    try {
      const mdContent = await citrineContentService.getCitrineContent();
      if (mdContent.includes('Citrine Clinic')) {
        console.log('Clinic info found in MD file');
        return this.extractClinicFromContent(mdContent, 'Clinic Data');
      }
    } catch (error) {
      console.log('MD file lookup for clinic info failed:', error);
    }
    
    // 3. Try Tavily last
    try {
      const tavilyContent = await tavilyService.crawlWebsite('https://www.citrineclinic.com/');
      console.log('Clinic info fetched from Tavily');
      return this.extractClinicFromContent(tavilyContent.content, 'Citrine Website');
    } catch (error) {
      console.log('Tavily lookup for clinic info failed:', error);
    }
    
    return this.getFallbackClinicInfo();
  }
  
  private formatDrNitiFromAPI(doctor: any): string {
    let response = `# Dr. ${doctor.name.replace(/^Dr\.\s*/, '')}\n\n`;
    response += `**Specialization:** ${doctor.specialization}\n`;
    response += `**Status:** ${doctor.is_available ? '🟢 Available' : '🔴 Not Available'}\n\n`;
    response += `*Source: Healthcare API*\n\n`;
    response += `💡 **Ready to consult with Dr. Niti Gaur?** Book your appointment today!`;
    return response;
  }
  
  private extractDrNitiFromContent(content: string, source: string): string {
    let response = `# Dr. Niti Gaur\n\n`;
    response += `**MBBS, MD - DERMATOLOGY, VENEREOLOGY & LEPROSY**\n`;
    response += `**DERMATOLOGIST, COSMETOLOGIST, TRICHOLOGIST**\n\n`;
    response += `Dr. Niti Gaur, MD, is the Medical Director and founder of Citrine Clinic. She is a board-certified Dermatologist with more than 20 years of experience in clinical and cosmetic dermatology and wellness.\n\n`;
    response += `**Education & Training:**\n`;
    response += `• MBBS and MD (Dermatology) from premier institutes\n`;
    response += `• Alumnus of B J Medical College, Pune\n`;
    response += `• Lady Hardinge Medical College, New Delhi\n\n`;
    response += `*Source: ${source}*\n\n`;
    response += `💡 **Ready to consult with Dr. Niti Gaur?** Book your appointment today!`;
    return response;
  }
  
  private formatClinicFromAPI(clinicInfo: any): string {
    let response = `# 🏥 ${clinicInfo.name}\n\n`;
    response += `## 📞 Contact Information\n`;
    response += `**Phone:** ${clinicInfo.phone}\n`;
    response += `**Email:** ${clinicInfo.email}\n\n`;
    response += `*Source: Healthcare API*\n\n`;
    response += `💡 **Ready to get started?** Feel free to contact us!`;
    return response;
  }
  
  private extractClinicFromContent(content: string, source: string): string {
    let response = `# 🏥 Citrine Clinic\n\n`;
    response += `## 🩺 Services Offered\n`;
    const services = this.extractServicesFromContent(content);
    services.forEach(service => {
      response += `• ${service}\n`;
    });
    response += `\n*Source: ${source}*\n\n`;
    response += `💡 **Ready to get started?** Feel free to contact us!`;
    return response;
  }
  
  private getFallbackDrNitiInfo(): string {
    return `# Dr. Niti Gaur\n\nI'm having trouble accessing detailed information about Dr. Niti Gaur right now. Please contact our clinic directly for more information.\n\n💡 **Contact us at:** +91-9810652808`;
  }
  
  private getFallbackClinicInfo(): string {
    return `# 🏥 Citrine Clinic\n\nI'm having trouble accessing detailed clinic information right now. Please contact us directly.\n\n💡 **Contact us at:** +91-9810652808`;
  }
}

export const mistralService = new MistralService();