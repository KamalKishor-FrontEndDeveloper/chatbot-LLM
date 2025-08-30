// Using fetch instead of tavily package
const TAVILY_API_KEY = "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";



export interface WebContent {
  url: string;
  title: string;
  content: string;
  summary: string;
}

export class TavilyService {
  async extractContent(urls: string[]): Promise<WebContent[]> {
    try {
      const response = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TAVILY_API_KEY}`
        },
        body: JSON.stringify({ urls })
      });
      
      const data = await response.json();
      const results = Array.isArray(data) ? data : data.results || [];
      console.log(results,"results ")
      return results.map((result: any) => ({
        url: result.url || urls[0],
        title: result.title || 'Citrine Clinic',
        content: result.raw_content || result.content || 'No content extracted',
        summary: this.generateSummary(result.raw_content || result.content)
      }));
    } catch (error) {
      console.error('Tavily extraction error:', error);
      return [{
        url: urls[0] || '',
        title: 'Citrine Clinic',
        content: 'Citrine Clinic offers comprehensive healthcare services...',
        summary: 'Healthcare services available'
      }];
    }
  }

  async searchAndExtract(query: string, maxResults = 3): Promise<WebContent[]> {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TAVILY_API_KEY}`
        },
        body: JSON.stringify({ query, max_results: maxResults })
      });
      
      const searchResults = await response.json();
      const urls = searchResults.results.map((r: any) => r.url);
      return await this.extractContent(urls);
    } catch (error) {
      console.error('Tavily search error:', error);
      return [];
    }
  }

  async crawlWebsite(url: string): Promise<WebContent> {
    try {
      const response = await fetch('https://api.tavily.com/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TAVILY_API_KEY}`
        },
        body: JSON.stringify({ 
          url,
          instructions: "Get all page information",
          extract_depth: "advanced"
        })
      });
      
      const result = await response.json();
      return {
        url: result.url || url,
        title: result.title || 'Citrine Clinic',
        content: result.raw_content || result.content || 'No content extracted',
        summary: this.generateSummary(result.raw_content || result.content)
      };
    } catch (error) {
      console.error('Tavily crawl error:', error);
      return {
        url,
        title: 'Citrine Clinic',
        content: 'No content extracted',
        summary: 'No summary available'
      };
    }
  }

  private generateSummary(content: string): string {
    if (!content) return 'No summary available';
    const sentences = content.split('.').slice(0, 2);
    return sentences.join('.') + '.';
  }
}

export const tavilyService = new TavilyService();