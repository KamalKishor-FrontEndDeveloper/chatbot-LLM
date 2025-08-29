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
      
      // Get relevant treatments based on the query
      const treatments = await this.getRelevantTreatments(userMessage, intent);
      
      // Generate a contextual response
      const response = await this.generateResponse(userMessage, treatments, intent);
      
      return {
        message: response,
        treatments: treatments.length > 0 ? treatments : undefined,
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
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are a healthcare intent analyzer. Analyze the user's message and determine their intent. 
          Respond with JSON in this format: {"intent": "category"}
          
          Possible intents:
          - "cost_inquiry" - asking about treatment costs/prices
          - "treatment_list" - wanting to see available treatments
          - "doctor_inquiry" - asking about doctors or doctor availability
          - "specific_treatment" - asking about a specific treatment
          - "comparison" - comparing treatments or services
          - "consultation" - wanting to book consultation or get consultation info
          - "general_info" - general healthcare questions
          - "other" - anything else`
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
      return result.intent || 'other';
    } catch {
      return 'other';
    }
  }

  private async getRelevantTreatments(userMessage: string, intent: string): Promise<HealthcareTreatment[]> {
    switch (intent) {
      case 'cost_inquiry':
        return await healthcareApi.getTreatmentsByPrice();
      
      case 'treatment_list':
        return await healthcareApi.getAllTreatments();
      
      case 'specific_treatment':
      case 'comparison':
        return await healthcareApi.searchTreatments(userMessage);
      
      default:
        return await healthcareApi.searchTreatments(userMessage);
    }
  }

  private async generateResponse(
    userMessage: string, 
    treatments: HealthcareTreatment[], 
    intent: string
  ): Promise<string> {
    const treatmentContext = treatments.length > 0 ? 
      `Available treatments: ${JSON.stringify(treatments.slice(0, 5))}` : 
      'No specific treatments found.';

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are HealthLantern AI, a helpful healthcare assistant. You have access to treatment data from a healthcare system.
          
          Guidelines:
          - Be professional, empathetic, and informative
          - If treatments are provided, reference them in your response
          - For cost inquiries, mention specific prices if available, otherwise suggest contacting for quotes
          - For treatment lists, summarize what's available
          - For doctor inquiries, mention doctor availability from the data
          - Always encourage users to consult with healthcare professionals for medical advice
          - Keep responses concise but informative
          - Use a warm, helpful tone
          
          Treatment data format:
          - id: unique identifier
          - t_name: treatment name
          - name: full name with category indicator (C) for condition, (T) for treatment
          - price: cost (empty string means contact for quote)
          - doctors: JSON array of doctor IDs
          - parent_id: parent category
          - children: sub-treatments`
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
