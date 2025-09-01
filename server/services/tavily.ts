// Using fetch instead of tavily package
const TAVILY_API_KEY = "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";
import { citrineContentService } from './citrine-content';



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
      // Use local Citrine content as a dynamic fallback
      const fallback = await citrineContentService.getCitrineContent();
      return [{
        url: urls[0] || '',
        title: 'Citrine Clinic',
        content: fallback,
        summary: (fallback || '').split('.').slice(0, 2).join('.') + '.'
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
  // Return dynamic fallback content when search fails
  const fallback = await citrineContentService.getCitrineContent();
  return [{ url: '', title: 'Citrine Clinic', content: fallback, summary: (fallback || '').split('.').slice(0,2).join('.') + '.' }];
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
      const fallback = await citrineContentService.getCitrineContent();
      return {
        url,
        title: 'Citrine Clinic',
        content: fallback || 'No content extracted',
        summary: (fallback || '').split('.').slice(0,2).join('.') + '.'
      };
    }
  }

  async extractSpecificContent(url: string, query: string): Promise<WebContent | null> {
    try {
      // Use Tavily's advanced search with site restriction for targeted content
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TAVILY_API_KEY}`
        },
        body: JSON.stringify({ 
          query: `site:citrineclinic.com ${query}`,
          max_results: 1,
          include_domains: ['citrineclinic.com'],
          search_depth: 'advanced'
        })
      });
      
      const searchResults = await response.json();
      if (searchResults.results && searchResults.results.length > 0) {
        const result = searchResults.results[0];
        return {
          url: result.url,
          title: result.title,
          content: result.content,
          summary: this.generateSummary(result.content)
        };
      }
      
      // Fallback to direct URL extraction
      return await this.crawlWebsite(url);
    } catch (error) {
      console.error('Tavily specific content extraction error:', error);
      // Fall back to local Citrine content if specific extraction fails
      const fallback = await citrineContentService.getCitrineContent();
      return {
        url,
        title: 'Citrine Clinic',
        content: fallback || 'No content extracted',
        summary: (fallback || '').split('.').slice(0,2).join('.') + '.'
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