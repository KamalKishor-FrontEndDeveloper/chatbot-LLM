import { LLMConfig } from './llm-provider';

// Simple in-memory storage for POC
let currentConfig: LLMConfig = {
  provider: 'mistral',
  apiKey: process.env.MISTRAL_API_KEY || '6apvdYw6attdCoWv0GuiSfaRZlfTGjt7',
  model: 'mistral-large-latest'
};

let userConfig: Partial<LLMConfig> | null = null;

export class LLMConfigService {
  getConfig(): LLMConfig {
    if (userConfig) {
      return {
        provider: userConfig.provider || currentConfig.provider,
        apiKey: userConfig.apiKey || this.getEnvKey(userConfig.provider || currentConfig.provider),
        model: userConfig.model || currentConfig.model
      };
    }
    return { ...currentConfig };
  }

  updateConfig(config: Partial<LLMConfig>): void {
    userConfig = { ...userConfig, ...config };
  }

  resetToDefault(): void {
    userConfig = null;
  }

  private getEnvKey(provider: 'openai' | 'mistral'): string {
    return provider === 'openai' 
      ? process.env.OPENAI_API_KEY || ''
      : process.env.MISTRAL_API_KEY || '6apvdYw6attdCoWv0GuiSfaRZlfTGjt7';
  }
}

export const llmConfigService = new LLMConfigService();