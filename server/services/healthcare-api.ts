import { HealthcareTreatment, Doctor, ClinicInfo, AppointmentBooking } from '@shared/schema';

export class HealthcareApiService {
  private readonly apiUrl = 'https://pmsapi.healthlantern.com/api/get_tree_list_for_treatment_chatboard/1a26495729bbc804007b72e98803cab4';
  private readonly doctorApiUrl = 'https://pmsapi.healthlantern.com/api/get_staff_List_chatboard/1a26495729bbc804007b72e98803cab4';
  private readonly appointmentApiUrl = 'https://pmsapi.healthlantern.com/api/Appointment_form_data_put';
  private readonly clinicApiUrl = 'https://pmsapi.healthlantern.com/api/organization_chatboard/c9ab83f09006371cb3f745a03b1f8c64';
  private readonly authToken = '1a26495729bbc804007b72e98803cab4';
  private citrineWebsiteContent: string | null = null;
  


  async getCitrineWebsiteContent(): Promise<string> {
    if (!this.citrineWebsiteContent) {
      const { tavilyService } = await import('./tavily');
      const content = await tavilyService.extractContent(['https://www.citrineclinic.com/']);
      this.citrineWebsiteContent = content.map(c => c.content).join('\n');
    }
    return this.citrineWebsiteContent;
  }

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
      
      let treatments: HealthcareTreatment[];
      if (data && data.statusCode === 200 && data.data && data.data.success && data.data.data) {
        treatments = data.data.data;
      } else if (data && Array.isArray(data)) {
        treatments = data;
      } else if (data && data.data && Array.isArray(data.data)) {
        treatments = data.data;
      } else {
        throw new Error('API response format is not as expected');
      }
      
      return treatments;
    } catch (error) {
      console.error('Healthcare API Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      throw new Error('Unable to fetch treatment data at this time');
    }
  }

  private async getFlatTreatments(): Promise<HealthcareTreatment[]> {
    const allTreatments = await this.getAllTreatments();
    return this.flattenTreatments(allTreatments);
  }

  async searchTreatments(query: string): Promise<HealthcareTreatment[]> {
    const flatTreatments = await this.getFlatTreatments();
    const searchTerms = query.toLowerCase().split(' ');
    
    return flatTreatments.filter(treatment => {
      const searchableText = `${treatment.t_name} ${treatment.name}`.toLowerCase();
      return searchTerms.some(term => searchableText.includes(term));
    });
  }

  async getTreatmentsByPrice(): Promise<HealthcareTreatment[]> {
    const flatTreatments = await this.getFlatTreatments();
    return flatTreatments.filter(treatment => treatment.price && treatment.price !== '');
  }

  async getTreatmentsByDoctor(doctorId: string): Promise<HealthcareTreatment[]> {
    const flatTreatments = await this.getFlatTreatments();
    
    return flatTreatments.filter(treatment => {
      if (!treatment.doctors) return false;
      try {
        const doctorIds = JSON.parse(treatment.doctors);
        return doctorIds.includes(parseInt(doctorId, 10));
      } catch {
        return false;
      }
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
      // console.log('Parsing doctors field:', treatment.doctors);
      const doctorIds = JSON.parse(treatment.doctors);
      // console.log('Parsed doctor IDs:', doctorIds);
      return Array.isArray(doctorIds) ? doctorIds : [];
    } catch (error) {
      console.error('Error parsing doctor IDs:', error);
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
      // console.log('Doctor API Response:', JSON.stringify(data, null, 2));
      
      let doctors: Doctor[] = [];
      
      // Parse the doctor data with rich profile information
      if (data && Array.isArray(data)) {
        doctors = data.map((doctor: any) => ({
          id: doctor.id,
          name: doctor.name || `Doctor ${doctor.id}`,
          specialization: doctor.specialization || 'General Practitioner',
          qualification: doctor.qualification || '',
          experience: doctor.experience || '',
          gender: doctor.gender || '',
          phone: doctor.phone || '',
          email: doctor.email || '',
          about: doctor.about_us || '',
          image: doctor.image || doctor.patient_image || '',
          address: doctor.street_address || '',
          city: doctor.city || '',
          state: doctor.state || '',
          services: doctor.services || '',
          is_available: doctor.status === 'active'
        }));
      }
      
      return doctors;
    } catch (error) {
      // console.error('Doctor API Error:', error);
      return [];
    }
  }

  async getDoctorsByIds(doctorIds: number[]): Promise<Doctor[]> {
    const allDoctors = await this.getAllDoctors();
    return allDoctors.filter(doctor => doctorIds.includes(doctor.id));
  }
  
  async getDoctorById(doctorId: number): Promise<Doctor | null> {
    const allDoctors = await this.getAllDoctors();
    return allDoctors.find(doctor => doctor.id === doctorId) || null;
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
      // console.log(response,"response")
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      // console.log('Clinic API Response:', JSON.stringify(data, null, 2));
      
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
      const response = await fetch(this.appointmentApiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'HealthLantern-ChatBot/1.0'
        },
        body: new URLSearchParams({
          name: appointment.name,
          email: appointment.email,
          phone: appointment.phone,
          date: appointment.date,
          service: appointment.service,
          clinic_location_id: (appointment.clinic_location_id || 1).toString(),
          message: appointment.message || 'Appointment booking via chatbot',
          app_source: appointment.app_source || 'https://www.healthlantern.com',
          auth_token: this.authToken
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseText = await response.text();
      console.log('Appointment API raw response:', responseText);
      
      if (!responseText.trim()) {
        return {
          success: false,
          message: 'Empty response from booking system. Please try again.'
        };
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse appointment response:', parseError);
        return {
          success: false,
          message: 'Invalid response from booking system. Please contact us directly at 9654122458.'
        };
      }
      
      if (data && (data.statusCode === 200 || responseText.includes('Lead enquiry created successfully'))) {
        return {
          success: true,
          message: 'Appointment request submitted successfully! Our team will contact you shortly to confirm your appointment.'
        };
      }
      
      return {
        success: false,
        message: data?.message || 'Failed to book appointment. Please contact us at 9654122458.'
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
    const flatTreatments = await this.getFlatTreatments();
  const searchTerms = query.toLowerCase();

  // Remove common words and non-alphanumeric characters, normalize whitespace
  let cleanQuery = searchTerms.replace(/\b(what|is|the|cost|of|price|for|in|treatment|therapy)\b/g, ' ');
  cleanQuery = cleanQuery.replace(/[^a-z0-9\s]/g, ' ');
  cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();
  const compactClean = cleanQuery.replace(/\s+/g, '');
    
    // Enhanced matching for common treatments
    const treatmentAliases: Record<string, string[]> = {
      'facelift': ['anti wrinkle injection', 'dermal filler', 'hifu', 'botox'],
      'botox': ['anti wrinkle injection', 'botulinum'],
      'hair transplant': ['hair restoration', 'hair implant'],
      'laser hair removal': ['laser hair reduction', 'lhr'],
      'acne': ['acne treatment', 'pimple treatment'],
      'lhr': ['laser hair removal', 'laser hair', 'hair removal']
    };
    
    // Helper to normalize treatment names similarly to the query
    const normalize = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const compact = (s?: string) => normalize(s).replace(/\s+/g, '');

    // Try exact match first (allow "face lift" vs "facelift" and minor punctuation/spacing differences)
    let exactMatch = flatTreatments.find(treatment => {
      const treatmentName = normalize(treatment.t_name);
      const treatmentNameCompact = compact(treatment.t_name);
      return treatmentName === cleanQuery || treatmentNameCompact === compactClean;
    });
    
    // Try alias matching
    if (!exactMatch) {
      for (const [key, aliases] of Object.entries(treatmentAliases)) {
        const normKey = key.toLowerCase().replace(/\s+/g, '');
        if (compactClean === normKey || cleanQuery === key) {
          exactMatch = flatTreatments.find(treatment => {
            const treatmentNameNorm = normalize(treatment.t_name);
            const treatmentNameCompact = compact(treatment.t_name);
            // match if any alias appears in the normalized treatment name or compact form
            return aliases.some(alias => {
              const a = alias.toLowerCase();
              return treatmentNameNorm.includes(a) || treatmentNameCompact.includes(a.replace(/\s+/g, ''));
            });
          });
          if (exactMatch) {
            console.log(`Found treatment via alias: ${exactMatch.t_name} for query: ${key}`);
            break;
          }
        }
      }
    }
    
    // Fallback: partial match
    if (!exactMatch) {
      exactMatch = flatTreatments.find(treatment => {
        const treatmentName = treatment.t_name?.toLowerCase() || '';
        return treatmentName.includes(cleanQuery) || cleanQuery.includes(treatmentName);
      });
    }
    
    return exactMatch || null;
  }
}

export const healthcareApi = new HealthcareApiService();
