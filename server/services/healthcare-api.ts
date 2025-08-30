import { HealthcareTreatment, Doctor, ClinicInfo, AppointmentBooking } from '@shared/schema';

export class HealthcareApiService {
  private readonly apiUrl = 'https://pmsapi.healthlantern.com/api/get_tree_list_for_treatment_chatboard/1a26495729bbc804007b72e98803cab4';
  private readonly doctorApiUrl = 'https://pmsapi.healthlantern.com/api/get_staff_List_chatboard/1a26495729bbc804007b72e98803cab4';
  private readonly appointmentApiUrl = 'https://pmsapi.healthlantern.com/api/Appointment_form_data_put';
  private readonly clinicApiUrl = 'https://pmsapi.healthlantern.com/api/organization_chatboard/1a26495729bbc804007b72e98803cab4';
  private readonly authToken = '1a26495729bbc804007b72e98803cab4';

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
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
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

  // New Doctor API methods
  async getAllDoctors(): Promise<Doctor[]> {
    try {
      const response = await fetch(this.doctorApiUrl, {
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
      
      // Parse the doctor data based on the API response structure
      if (data && data.success === true && data.data) {
        return data.data.map((doctor: any) => ({
          id: doctor.id,
          name: doctor.name || `Doctor ${doctor.id}`,
          specialization: doctor.specialization || doctor.department || doctor.user_type || 'General',
          is_available: doctor.is_available !== false
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Doctor API Error:', error);
      return [];
    }
  }

  async getDoctorsByIds(doctorIds: number[]): Promise<Doctor[]> {
    const allDoctors = await this.getAllDoctors();
    return allDoctors.filter(doctor => doctorIds.includes(doctor.id));
  }

  // Clinic Info API
  async getClinicInfo(): Promise<ClinicInfo | null> {
    try {
      const response = await fetch(this.clinicApiUrl, {
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
      console.log('Clinic API Response:', JSON.stringify(data, null, 2));
      
      if (data && data.success === true && data.organization) {
        const orgData = data.organization;
        return {
          name: orgData.org_name || orgData.name || orgData.organization_name || 'HealthLantern Medical Center',
          address: orgData.org_address || orgData.address,
          phone: orgData.org_pri_phone_no || orgData.phone,
          email: orgData.org_email || orgData.email,
          working_hours: orgData.working_hours || 'Mon-Sat: 9 AM - 6 PM',
          services: orgData.services || []
        };
      }
      
      return null;
    } catch (error) {
      console.error('Clinic Info API Error:', error);
      return null;
    }
  }

  // Appointment Booking API
  async bookAppointment(appointment: AppointmentBooking): Promise<{ success: boolean; message: string }> {
    try {
      const params = new URLSearchParams({
        name: appointment.name,
        email: appointment.email,
        phone: appointment.phone,
        date: appointment.date,
        service: appointment.service,
        clinic_location_id: (appointment.clinic_location_id || 1).toString(),
        message: appointment.message || 'Appointment booking via chatbot',
        app_source: appointment.app_source || 'https://www.healthlantern.com',
        auth_token: this.authToken
      });

      const response = await fetch(`${this.appointmentApiUrl}?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HealthLantern-ChatBot/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.statusCode === 200) {
        return {
          success: true,
          message: 'Appointment booked successfully! You will receive a confirmation email shortly.'
        };
      }
      
      return {
        success: false,
        message: data.message || 'Failed to book appointment. Please try again.'
      };
    } catch (error) {
      console.error('Appointment Booking Error:', error);
      return {
        success: false,
        message: 'Unable to book appointment at this time. Please try again later.'
      };
    }
  }

  // Enhanced method to get specific treatment (no related items)
  async getSpecificTreatment(query: string): Promise<HealthcareTreatment | null> {
    const allTreatments = await this.getAllTreatments();
    const flatTreatments = this.flattenTreatments(allTreatments);
    
    const searchTerms = query.toLowerCase();
    
    // Remove common words to improve matching
    const cleanQuery = searchTerms.replace(/\b(what|is|the|cost|of|price|for|in|treatment|therapy)\b/g, '').trim();
    
    // Try exact name match first
    let exactMatch = flatTreatments.find(treatment => {
      const treatmentName = treatment.t_name?.toLowerCase() || '';
      const fullName = treatment.name?.toLowerCase() || '';
      
      // Check for exact treatment name match
      return treatmentName === cleanQuery || 
             treatmentName.includes(cleanQuery) || 
             fullName.includes(cleanQuery) ||
             cleanQuery.includes(treatmentName);
    });
    
    // If no exact match, try fuzzy matching with key terms
    if (!exactMatch) {
      const keyTerms = cleanQuery.split(' ').filter(term => term.length > 2);
      exactMatch = flatTreatments.find(treatment => {
        const treatmentName = treatment.t_name?.toLowerCase() || '';
        const fullName = treatment.name?.toLowerCase() || '';
        
        return keyTerms.every(term => 
          treatmentName.includes(term) || fullName.includes(term)
        );
      });
    }
    
    return exactMatch || null;
  }
}

export const healthcareApi = new HealthcareApiService();
