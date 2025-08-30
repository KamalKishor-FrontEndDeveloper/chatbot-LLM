import OpenAI from 'openai';
import { HealthcareTreatment } from '@shared/schema';
import { healthcareApi } from './healthcare-api';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "",
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

export class OpenAIService {
  async processHealthcareQuery(userMessage: string): Promise<ChatResponse> {
    try {
      // First, analyze the user's intent
      const intent = await this.analyzeIntent(userMessage);

      // Handle off-topic questions with guard rails
      if (intent === 'off_topic') {
        return {
          message: "I'm HealthLantern AI, your healthcare assistant. I'm here to help you with medical treatments, costs, doctor availability, and health-related questions.\n\nI can help you with:\n• Treatment information and pricing\n• Doctor availability and specializations\n• Healthcare consultations\n• Medical conditions and their treatments\n\nWhat healthcare question can I assist you with today?",
          intent: 'off_topic',
        };
      }

      // Get relevant treatments based on the query
      const treatments = await this.getRelevantTreatments(userMessage, intent);

      // Generate a contextual response
      const response = await this.generateResponse(userMessage, treatments, intent);

      // For specific queries, only show the specific treatment requested
      const isSpecificQuery = this.isSpecificCostQuery(userMessage) || intent === 'specific_treatment';

      let finalTreatments: HealthcareTreatment[] | undefined;
      if (isSpecificQuery) {
        // For specific queries, only return the exact match, no related treatments
        finalTreatments = treatments.length > 0 ? [treatments[0]] : undefined;
      } else if (intent === 'treatment_selection') {
        // For treatment selection, don't show treatment cards - user has already selected
        finalTreatments = undefined;
      } else {
        // For general queries, return multiple treatments as before
        const priceLimit = this.extractPriceLimit(userMessage);
        const isSpecificPriceQuery = intent === 'cost_inquiry' && priceLimit !== null;
        const shouldShowTreatments = (isSpecificPriceQuery && treatments.length === 0) ? false : treatments.length > 0;
        finalTreatments = shouldShowTreatments ? treatments : undefined;
      }

      return {
        message: response,
        treatments: finalTreatments,
        intent,
      };
    } catch (error) {
      console.error('OpenAI Service Error:', error);
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
      console.log(`Off-topic detected via keywords: "${userMessage}"`);
      return 'off_topic';
    }

    // Check for appointment booking keywords that indicate user wants to proceed
    const appointmentKeywords = [
      'book', 'schedule', 'appointment', 'consultation', 'proceed', 'yes', 'okay', 'ok',
      'i want', 'interested', 'how to book', 'next step', 'go ahead'
    ];

    const hasAppointmentIntent = appointmentKeywords.some(keyword => 
      lowerMessage.includes(keyword) || lowerMessage === keyword
    );

    if (hasAppointmentIntent) {
      console.log(`Appointment booking intent detected: "${userMessage}"`);
      return 'appointment_booking';
    }

    // Check if this is a simple treatment selection (single words like "Hairfall", "Hair Transplant")
    const treatmentSelectionPattern = /^[a-zA-Z\s]{3,30}$/;
    const commonTreatments = ['hairfall', 'hair transplant', 'dental', 'skin treatment', 'eye care'];

    if (treatmentSelectionPattern.test(userMessage) && 
        commonTreatments.some(treatment => lowerMessage.includes(treatment.replace(/\s+/g, '')) || treatment.includes(lowerMessage))) {
      console.log(`Treatment selection detected: "${userMessage}"`);
      return 'treatment_selection';
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are a strict healthcare intent classifier. Be very careful to classify non-medical questions as "off_topic".

          Respond with JSON in this format: {"intent": "category"}

          Healthcare intents (ONLY for medical/health questions):
          - "cost_inquiry" - asking about medical treatment costs/prices
          - "treatment_list" - wanting to see available medical treatments
          - "doctor_inquiry" - asking about doctors or doctor availability
          - "specific_treatment" - asking about a specific medical treatment
          - "comparison" - comparing medical treatments or services
          - "appointment_booking" - wanting to book an appointment or consultation
          - "clinic_info" - asking about clinic details, address, hours, services
          - "general_info" - general healthcare/medical questions
          - "other" - other healthcare related topics

          NON-healthcare intent (use for ALL non-medical questions):
          - "off_topic" - geography, capitals, sports, entertainment, technology, politics, weather, general knowledge, cooking, travel, or ANY non-medical topic

          Examples:
          - "What is the capital of India?" -> {"intent": "off_topic"}
          - "Who won the World Cup?" -> {"intent": "off_topic"}
          - "What's the weather today?" -> {"intent": "off_topic"}
          - "Cost of dental treatment?" -> {"intent": "cost_inquiry"}
          - "Show me heart treatments" -> {"intent": "treatment_list"}
          - "Which doctors are available?" -> {"intent": "doctor_inquiry"}
          - "Book an appointment" -> {"intent": "appointment_booking"}
          - "What is your clinic address?" -> {"intent": "clinic_info"}`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      response_format: { type: "json_object" },
    });

    try {
      const result = JSON.parse(response.choices[0].message.content || '{"intent": "other"}');
      const intent = result.intent || 'other';
      console.log(`Intent analysis for "${userMessage}": ${intent}`);
      return intent;
    } catch {
      console.log(`Intent analysis failed for "${userMessage}", defaulting to other`);
      return 'other';
    }
  }

  private async getRelevantTreatments(userMessage: string, intent: string): Promise<HealthcareTreatment[]> {
    switch (intent) {
      case 'cost_inquiry':
        // For specific cost questions, return only the specific treatment
        if (this.isSpecificCostQuery(userMessage)) {
          const specificTreatment = await healthcareApi.getSpecificTreatment(userMessage);
          return specificTreatment ? [specificTreatment] : [];
        }
        // Check if user specified a price range
        const priceLimit = this.extractPriceLimit(userMessage);
        if (priceLimit !== null) {
          return await this.filterTreatmentsByPrice(priceLimit, userMessage);
        }
        return await healthcareApi.getTreatmentsByPrice();

      case 'treatment_list':
        return await healthcareApi.getAllTreatments();

      case 'specific_treatment':
        // For specific treatment queries, return only the specific treatment
        const specificTreatment = await healthcareApi.getSpecificTreatment(userMessage);
        return specificTreatment ? [specificTreatment] : [];

      case 'comparison':
        return await healthcareApi.searchTreatments(userMessage);

      case 'doctor_inquiry':
        // For doctor queries, search for treatments to find relevant doctors
        return await healthcareApi.searchTreatments(userMessage);
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
        return parseInt(match[1]);
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
    intent: string
  ): Promise<string> {
    // Handle different intents with specific API calls
    switch (intent) {
      case 'doctor_inquiry':
        return await this.handleDoctorInquiry(userMessage, treatments);

      case 'appointment_booking':
        return await this.handleAppointmentBooking(userMessage);

      case 'clinic_info':
        return await this.handleClinicInfo(userMessage);

      case 'treatment_selection':
        return await this.handleTreatmentSelection(userMessage, treatments);

      default:
        return await this.handleTreatmentResponse(userMessage, treatments, intent);
    }
  }

  private async handleDoctorInquiry(userMessage: string, treatments: HealthcareTreatment[]): Promise<string> {
    try {
      // Check if user is asking about specific treatment/service
      const isSpecificServiceQuery = userMessage.toLowerCase().includes('perform') || 
                                   userMessage.toLowerCase().includes('who does') ||
                                   userMessage.toLowerCase().includes('specialists');

      let doctors;
      if (treatments.length > 0 && isSpecificServiceQuery) {
        // Get doctors for specific treatments
        const doctorIds = treatments.flatMap(t => healthcareApi.getDoctorIds(t));
        const uniqueDoctorIds = Array.from(new Set(doctorIds));
        doctors = await healthcareApi.getDoctorsByIds(uniqueDoctorIds);

        if (doctors.length === 0) {
          return `I couldn't find any doctors available for the specific treatments you mentioned. However, here are our general practitioners who can help evaluate and refer you to specialists if needed.\n\nPlease contact our clinic at **9654122458** for more specific doctor availability.`;
        }
      } else {
        // Get all available doctors
        doctors = await healthcareApi.getAllDoctors();
      }

      if (doctors.length === 0) {
        return "I'm sorry, I couldn't find any doctors available at the moment. Please contact our clinic directly for doctor availability.";
      }

      // Clean up doctor names and filter out non-medical staff for specific queries
      const filteredDoctors = isSpecificServiceQuery 
        ? doctors.filter(d => d.specialization === 'doctor' || d.specialization.toLowerCase().includes('specialist'))
        : doctors;

      let response = isSpecificServiceQuery 
        ? `Here are the doctors who can help with your specific treatment:\n\n`
        : `Here are our available doctors:\n\n`;

      filteredDoctors.forEach((doctor, index) => {
        const cleanName = doctor.name.replace(/^Dr\.\s*/, '');
        const specialization = doctor.specialization === 'doctor' ? 'Medical Doctor' : 
                              doctor.specialization === 'front-desk' ? 'Administrative Staff' :
                              doctor.specialization.charAt(0).toUpperCase() + doctor.specialization.slice(1);

        response += `**${index + 1}. Dr. ${cleanName}**\n`;
        response += `   *Specialization:* ${specialization}\n`;
        response += `   *Status:* ${doctor.is_available ? '🟢 Available' : '🔴 Not Available'}\n\n`;
      });

      response += `💡 *To book an appointment, just let me know which doctor you'd prefer!*`;
      return response;
    } catch (error) {
      console.error('Doctor inquiry error:', error);
      return "I'm having trouble accessing doctor information right now. Please try again later or contact our clinic directly.";
    }
  }

  private async handleAppointmentBooking(userMessage: string): Promise<string> {
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
      // Show booking form
      return `# 📅 Appointment Booking

I'd be happy to help you book an appointment! To proceed, I'll need the following information:

## 📋 Required Details

- **Full Name:** Your complete name
- **Email Address:** For appointment confirmation
- **Phone Number:** Contact number  
- **Preferred Date:** In YYYY-MM-DD format
- **Service Type:** Type of consultation needed
- **Message:** Any specific concerns or notes *(optional)*

## 🏥 Example Format

*"Book appointment for John Doe, email: john@email.com, phone: 9876543210, date: 2025-01-25, service: Hair Transplant, message: Consultation for hair transplant"*

---

💡 **Please provide these details and I'll book your appointment right away!** Our clinic contact information is available if you need it.`;
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

  private async handleClinicInfo(userMessage: string): Promise<string> {
    try {
      const clinicInfo = await healthcareApi.getClinicInfo();

      if (!clinicInfo) {
        return "I'm sorry, I couldn't retrieve clinic information at the moment. Please contact us directly for details.";
      }

      let response = `# 🏥 ${clinicInfo.name}\n\n`;

      if (clinicInfo.phone) {
        response += `## 📞 Contact Information\n`;
        response += `**Phone:** ${clinicInfo.phone}\n\n`;
      }

      if (clinicInfo.email) {
        response += `**Email:** ${clinicInfo.email}\n\n`;
      }

      if (clinicInfo.address) {
        response += `## 📍 Location\n`;
        response += `${clinicInfo.address}\n\n`;
      }

      if (clinicInfo.working_hours) {
        response += `## 🕒 Working Hours\n`;
        response += `${clinicInfo.working_hours}\n\n`;
      }

      if (clinicInfo.services && clinicInfo.services.length > 0) {
        response += `## 🩺 Services Offered\n`;
        clinicInfo.services.forEach(service => {
          response += `- ${service}\n`;
        });
        response += '\n';
      }

      response += `---\n\n💡 **Ready to get started?** Feel free to contact us or ask me to book an appointment!`;
      return response;
    } catch (error) {
      console.error('Clinic info error:', error);
      return "I'm having trouble accessing clinic information right now. Please try again later.";
    }
  }

  private async handleTreatmentResponse(
    userMessage: string, 
    treatments: HealthcareTreatment[], 
    intent: string
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

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are HealthLantern AI, a helpful healthcare assistant. You have access to treatment data from a healthcare system.

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

          ${treatmentContext}`;

    // Special handling for greetings and off-topic messages
    if (intent === 'off_topic' && (userMessage.toLowerCase().includes('hi') || userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hey'))) {
      systemMessage += `

      For greeting messages, respond with a warm welcome that includes:
      1. A friendly introduction stating you are HealthLantern AI
      2. A clear description of your role as a healthcare assistant
      3. A properly formatted list of capabilities using bullet points
      4. An invitation to ask a healthcare question

      Format example:
      I'm HealthLantern AI, your healthcare assistant. I'm here to help you with medical treatments, costs, doctor availability, and health-related questions.

      I can help you with:
      • Treatment information and pricing
      • Doctor availability and specializations
      • Healthcare consultations
      • Medical conditions and their treatments

      What healthcare question can I assist you with today?`;
    }

    if (intent === 'appointment_booking') {
      // This block seems to be for generating the system message related to appointment booking,
      // but the original code structure suggests it might be intended for a different purpose or part of another logic.
      // Given the context of fixing the greeting message, this specific 'if' block within handleTreatmentResponse might be misplaced or redundant for the current fix.
      // However, to maintain the original code structure and apply the requested change, it's kept here.
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: userMessage
        }
      ],
    });

    return response.choices[0].message.content || 
      "I'd be happy to help you with information about our healthcare treatments and services.";
  }
}

export const openAIService = new OpenAIService();