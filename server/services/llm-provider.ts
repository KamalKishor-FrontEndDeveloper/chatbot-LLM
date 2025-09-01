import { Mistral } from '@mistralai/mistralai';
import OpenAI from 'openai';

export interface LLMConfig {
  provider: 'openai' | 'mistral';
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
}

export interface StreamingChatResponse {
  stream: AsyncIterable<string>;
}

export class LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async chat(messages: ChatMessage[], options?: { responseFormat?: { type: string } }): Promise<ChatResponse> {
    switch (this.config.provider) {
      case 'openai':
        return this.chatOpenAI(messages, options);
      case 'mistral':
        return this.chatMistral(messages, options);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  async chatStream(messages: ChatMessage[]): Promise<StreamingChatResponse> {
    switch (this.config.provider) {
      case 'openai':
        return this.chatStreamOpenAI(messages);
      case 'mistral':
        return this.chatStreamMistral(messages);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private async chatOpenAI(messages: ChatMessage[], options?: { responseFormat?: { type: string } }): Promise<ChatResponse> {
    const openai = new OpenAI({ apiKey: this.config.apiKey });
    
    const response = await openai.chat.completions.create({
      model: this.config.model,
      messages: messages as any,
      ...(options?.responseFormat && { response_format: options.responseFormat as any })
    });

    return {
      content: response.choices[0]?.message?.content || ''
    };
  }

  private async chatMistral(messages: ChatMessage[], options?: { responseFormat?: { type: string } }): Promise<ChatResponse> {
    const mistral = new Mistral({ apiKey: this.config.apiKey });
    
    try {
      const response = await mistral.chat.complete({
        model: this.config.model,
        messages: messages as any,
        ...(options?.responseFormat && { responseFormat: options.responseFormat })
      });

      const rawContent = response.choices?.[0]?.message?.content;
      let content = '';
      
      if (typeof rawContent === 'string') {
        content = rawContent;
      } else if (Array.isArray(rawContent)) {
        content = rawContent.map(chunk => 
          typeof chunk === 'string' ? chunk : 
          (chunk?.text ?? chunk?.content ?? JSON.stringify(chunk))
        ).join('');
      }

      return { content };
    } catch (error: any) {
      // Handle rate limiting - fallback to smaller model
      if (error?.statusCode === 429 && this.config.model === 'mistral-large-latest') {
        console.log('Rate limited, falling back to mistral-small-latest');
        const fallbackResponse = await mistral.chat.complete({
          model: 'mistral-small-latest',
          messages: messages as any,
          ...(options?.responseFormat && { responseFormat: options.responseFormat })
        });
        
        const rawContent = fallbackResponse.choices?.[0]?.message?.content;
        return { content: typeof rawContent === 'string' ? rawContent : '' };
      }
      throw error;
    }
  }

  private async chatStreamOpenAI(messages: ChatMessage[]): Promise<StreamingChatResponse> {
    const openai = new OpenAI({ apiKey: this.config.apiKey });
    
    const stream = await openai.chat.completions.create({
      model: this.config.model,
      messages: messages as any,
      stream: true
    });

    return {
      stream: this.processOpenAIStream(stream)
    };
  }

  private async chatStreamMistral(messages: ChatMessage[]): Promise<StreamingChatResponse> {
    const mistral = new Mistral({ apiKey: this.config.apiKey });
    
    const stream = await mistral.chat.stream({
      model: this.config.model,
      messages: messages as any
    });

    return {
      stream: this.processMistralStream(stream)
    };
  }

  private async* processOpenAIStream(stream: any): AsyncIterable<string> {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  private async* processMistralStream(stream: any): AsyncIterable<string> {
    try {
      for await (const chunk of stream) {
        const content = chunk.data?.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('Mistral stream processing error:', error);
      yield 'Error processing stream';
    }
  }
}

// Default models for each provider
export const DEFAULT_MODELS = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest']
};