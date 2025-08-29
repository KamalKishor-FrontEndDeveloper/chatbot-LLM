import { HealthcareTreatment } from '@shared/schema';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  treatments?: HealthcareTreatment[];
  intent?: string;
}

export interface ChatResponse {
  success: boolean;
  data?: {
    message: string;
    treatments?: HealthcareTreatment[];
    intent?: string;
    timestamp: string;
  };
  error?: string;
}

export interface SuggestedQuery {
  icon: string;
  title: string;
  example: string;
  color: string;
}
