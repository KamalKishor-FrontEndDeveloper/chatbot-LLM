import fs from 'fs';
import path from 'path';

export class CitrineContentService {
  private static instance: CitrineContentService;
  private content: string | null = null;

  static getInstance(): CitrineContentService {
    if (!CitrineContentService.instance) {
      CitrineContentService.instance = new CitrineContentService();
    }
    return CitrineContentService.instance;
  }

  async getCitrineContent(): Promise<string> {
    if (!this.content) {
      try {
        const filePath = path.join(process.cwd(), 'server', 'services', 'citrinecline.md');
        const rawContent = fs.readFileSync(filePath, 'utf-8');
        
        // Parse JSON and extract raw_content
        const jsonData = JSON.parse(rawContent);
        this.content = jsonData.results
          .map((result: any) => result.raw_content)
          .join('\n\n');
      } catch (error) {
        console.error('Error reading Citrine content:', error);
        this.content = 'Citrine Clinic content not available';
      }
    }
    return this.content;
  }
}

export const citrineContentService = CitrineContentService.getInstance();