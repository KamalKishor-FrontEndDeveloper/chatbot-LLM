import { HealthcareTreatment } from '@shared/schema';

export class HealthcareApiService {
  private readonly apiUrl = 'https://pmsapi.healthlantern.com/api/get_tree_list_for_treatment_chatboard/1a26495729bbc804007b72e98803cab4';

  async getAllTreatments(): Promise<HealthcareTreatment[]> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HealthLantern-ChatBot/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if response has the expected structure from your API
      if (data && data.statusCode === 200 && data.data && data.data.success && data.data.data) {
        return data.data.data;
      }
      
      // If the structure is slightly different, try alternative parsing
      if (data && Array.isArray(data)) {
        return data;
      }
      
      if (data && data.data && Array.isArray(data.data)) {
        return data.data;
      }
      
      throw new Error('API response format is not as expected');
    } catch (error) {
      console.error('Healthcare API Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw new Error('Unable to fetch treatment data at this time');
    }
  }

  async searchTreatments(query: string): Promise<HealthcareTreatment[]> {
    const allTreatments = await this.getAllTreatments();
    const flatTreatments = this.flattenTreatments(allTreatments);
    
    const searchTerms = query.toLowerCase().split(' ');
    
    return flatTreatments.filter(treatment => {
      const searchableText = `${treatment.t_name} ${treatment.name}`.toLowerCase();
      return searchTerms.some(term => searchableText.includes(term));
    });
  }

  async getTreatmentsByPrice(): Promise<HealthcareTreatment[]> {
    const allTreatments = await this.getAllTreatments();
    const flatTreatments = this.flattenTreatments(allTreatments);
    
    return flatTreatments.filter(treatment => treatment.price && treatment.price !== '');
  }

  async getTreatmentsByDoctor(doctorId: string): Promise<HealthcareTreatment[]> {
    const allTreatments = await this.getAllTreatments();
    const flatTreatments = this.flattenTreatments(allTreatments);
    
    return flatTreatments.filter(treatment => {
      if (!treatment.doctors) return false;
      const doctorIds = JSON.parse(treatment.doctors);
      return doctorIds.includes(parseInt(doctorId));
    });
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

  getDoctorCount(treatment: HealthcareTreatment): number {
    if (!treatment.doctors) return 0;
    try {
      const doctorIds = JSON.parse(treatment.doctors);
      return Array.isArray(doctorIds) ? doctorIds.length : 0;
    } catch {
      return 0;
    }
  }

  getDoctorIds(treatment: HealthcareTreatment): number[] {
    if (!treatment.doctors) return [];
    try {
      const doctorIds = JSON.parse(treatment.doctors);
      return Array.isArray(doctorIds) ? doctorIds : [];
    } catch {
      return [];
    }
  }
}

export const healthcareApi = new HealthcareApiService();
