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
      case 'appointment_booking':
      case 'clinic_info':
        // These intents don't need treatment data
        return [];
      
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
      
      default:
        return await this.handleTreatmentResponse(userMessage, treatments, intent);
    }
  }

  private async handleDoctorInquiry(userMessage: string, treatments: HealthcareTreatment[]): Promise<string> {
    try {
      // Get all doctors or specific doctors based on treatments
      let doctors;
      if (treatments.length > 0) {
        // Get doctors for specific treatments
        const doctorIds = treatments.flatMap(t => healthcareApi.getDoctorIds(t));
        const uniqueDoctorIds = Array.from(new Set(doctorIds));
        doctors = await healthcareApi.getDoctorsByIds(uniqueDoctorIds);
      } else {
        // Get all available doctors
        doctors = await healthcareApi.getAllDoctors();
      }

      if (doctors.length === 0) {
        return "I'm sorry, I couldn't find any doctors available at the moment. Please contact our clinic directly for doctor availability.";
      }

      let response = "Here are the available doctors:\n\n";
      doctors.forEach((doctor, index) => {
        response += `${index + 1}. **Dr. ${doctor.name}** - ${doctor.specialization}\n`;
        response += `   Status: ${doctor.is_available ? '✅ Available' : '❌ Not Available'}\n\n`;
      });

      response += "Would you like to book an appointment with any of these doctors? Just let me know!";
      return response;
    } catch (error) {
      console.error('Doctor inquiry error:', error);
      return "I'm having trouble accessing doctor information right now. Please try again later or contact our clinic directly.";
    }
  }

  private async handleAppointmentBooking(userMessage: string): Promise<string> {
    return `I'd be happy to help you book an appointment! To proceed, I'll need the following information:

📋 **Required Details:**
• Your full name
• Email address  
• Phone number
• Preferred date (YYYY-MM-DD format)
• Type of service/consultation needed
• Any specific message or concerns

🏥 **Example:**
"Book appointment for John Doe, email: john@email.com, phone: 9876543210, date: 2025-09-15, service: General Consultation, message: Regular checkup"

Please provide these details and I'll book your appointment right away! Our clinic is located at the address available in our clinic information.`;
  }

  private async handleClinicInfo(userMessage: string): Promise<string> {
    try {
      const clinicInfo = await healthcareApi.getClinicInfo();
      
      if (!clinicInfo) {
        return "I'm sorry, I couldn't retrieve clinic information at the moment. Please contact us directly for details.";
      }

      let response = `🏥 **${clinicInfo.name}**\n\n`;
      
      if (clinicInfo.address) {
        response += `📍 **Address:** ${clinicInfo.address}\n\n`;
      }
      
      if (clinicInfo.phone) {
        response += `📞 **Phone:** ${clinicInfo.phone}\n\n`;
      }
      
      if (clinicInfo.email) {
        response += `📧 **Email:** ${clinicInfo.email}\n\n`;
      }
      
      if (clinicInfo.working_hours) {
        response += `🕒 **Working Hours:** ${clinicInfo.working_hours}\n\n`;
      }
      
      if (clinicInfo.services && clinicInfo.services.length > 0) {
        response += `🩺 **Services Offered:**\n`;
        clinicInfo.services.forEach(service => {
          response += `• ${service}\n`;
        });
        response += '\n';
      }

      response += "Feel free to contact us or book an appointment anytime!";
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
          - Use proper formatting with clear line breaks and bullet points when listing information
          - If no treatments match specific price criteria, politely explain this and suggest alternatives (higher budget ranges)
          - If treatments are provided, reference them in your response
          - For cost inquiries with no results, suggest the closest available options or alternative budget ranges
          - For treatment lists, summarize what's available in an organized way
          - Always encourage users to consult with healthcare professionals for medical advice
          - Keep responses concise but informative and well-formatted
          - Use a warm, helpful tone
          - When suggesting alternatives, be specific about price ranges (e.g., "under ₹500" or "under ₹1000")
          
          Treatment data format:
          - id: unique identifier
          - t_name: treatment name
          - name: full name with category indicator (C) for condition, (T) for treatment
          - price: cost (empty string means contact for quote)
          - doctors: JSON array of doctor IDs
          - parent_id: parent category
          - children: sub-treatments
          
          IMPORTANT: If no treatments match the user's price criteria, DO NOT suggest showing expensive treatments. Instead, suggest reasonable alternative price ranges.`
        },
        {
          role: "user",
          content: `User message: "${userMessage}"
          
          Intent: ${intent}
          
          ${treatmentContext}`
        }
      ],
    });

    return response.choices[0].message.content || 
      "I'd be happy to help you with information about our healthcare treatments and services.";
  }
}

export const openAIService = new OpenAIService();
