import { HealthcareTreatment, Doctor, ClinicInfo, AppointmentBooking } from '@shared/schema';
// import { fallbackDataService } from './fallback-data';

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
      console.log('Attempting to fetch treatments from:', this.apiUrl);
      
      // const controller = new AbortController();
      // const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      let response: Response;
      try {
        response = await fetch(this.apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'HealthLantern-ChatBot/1.0'
          },
        });
      } catch (err) {
        // handle fetch abort due to timeout
        if ((err as Error).name === 'AbortError') {
          console.error('Healthcare API request aborted due to timeout');
          throw new Error('Healthcare API is currently unavailable (timeout)');
        }
        throw err;
      } finally {
        // clearTimeout(timeoutId);
      }
      
      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 504) {
          console.error('Healthcare API Gateway Timeout (504) - Server is not responding');
          throw new Error('Healthcare API is currently unavailable (Gateway Timeout)');
        } else if (response.status >= 500) {
          console.error(`Healthcare API Server Error (${response.status})`);
          throw new Error(`Healthcare API server error (${response.status})`);
        } else {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      
      const data = await response.json();
      console.log('API Response data structure:', {
        hasData: !!data,
        isArray: Array.isArray(data),
        keys: data ? Object.keys(data) : [],
        statusCode: data?.statusCode,
        dataType: typeof data?.data
      });
      
      let treatments: HealthcareTreatment[];
      if (data && data.success && data.data && Array.isArray(data.data)) {
        treatments = data.data;
      } else if (data && Array.isArray(data)) {
        treatments = data;
      } else {
        console.error('Unexpected API response format:', JSON.stringify(data, null, 2));
        throw new Error('API response format is not as expected');
      }

      // Remove non-dermatology items (e.g., dental/teeth services) that may come from the external CRM
      // Citrine Clinic is a dermatology clinic; filter out obvious dental keywords to avoid showing those cards.
      try {
        treatments = this.filterOutNonDermatologyTreatments(treatments);
      } catch (err) {
        console.warn('Filtering treatments failed, returning original list', err);
      }
      
      console.log(`Successfully fetched ${treatments.length} treatments`);
      return treatments;
    } catch (error) {
      console.error('Healthcare API Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        url: this.apiUrl
      });
      
      // Return empty array when API is unavailable to force real-time data
      console.log('Treatment API unavailable - returning empty array');
      return [];
    }
  }

  /**
   * Recursively filter out treatments that clearly belong to dental/oral specialties so the
   * Citrine Clinic frontend only shows dermatology/aesthetic services.
   */
  private filterOutNonDermatologyTreatments(treatments: HealthcareTreatment[]): HealthcareTreatment[] {
    if (!Array.isArray(treatments) || treatments.length === 0) return treatments;

    const bannedKeywords = ['tooth', 'teeth', 'dental', 'dentist', 'whiten', 'whitening', 'oral', 'root canal', 'extraction'];

    const containsBanned = (s?: string) => {
      if (!s) return false;
      const low = String(s).toLowerCase();
      return bannedKeywords.some(k => low.includes(k));
    };

    const recurse = (items: any[]): any[] => {
      const out: any[] = [];
      for (const item of items) {
        // If the item title/name contains a banned keyword, skip it
        if (containsBanned(item.t_name) || containsBanned(item.name) || containsBanned(item.title)) {
          continue;
        }

        const copy = { ...item };
        if (copy.children && Array.isArray(copy.children)) {
          copy.children = recurse(copy.children);
        }
        out.push(copy);
      }
      return out;
    };

    try {
      return recurse(treatments as any[]);
    } catch (e) {
      console.error('Error while filtering treatments:', e);
      return treatments;
    }
  }

  private async getFlatTreatments(): Promise<HealthcareTreatment[]> {
    const allTreatments = await this.getAllTreatments();
    return this.flattenTreatments(allTreatments);
  }



  async searchTreatments(query: string): Promise<HealthcareTreatment[]> {
    const flatTreatments = await this.getFlatTreatments();
    const lowerQuery = query.toLowerCase();
    
 
    
    const searchTerms = lowerQuery.split(' ').filter(term => term.length > 2);
    
    return flatTreatments.filter(treatment => {
      const searchableText = `${treatment.t_name} ${treatment.name}`.toLowerCase();
      // Require all significant search terms to be present
      return searchTerms.every(term => searchableText.includes(term));
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
        if (response.status === 504) {
          console.error('Doctor API Gateway Timeout (504)');
          throw new Error('Doctor API is currently unavailable');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      // console.log('Doctor API Response received:', {
      //   hasData: !!result.data,
      //   isDirectArray: Array.isArray(result),
      //   resultKeys: Object.keys(result || {}),
      //   dataLength: Array.isArray(result) ? result.length : (Array.isArray(result.data) ? result.data.length : 'not array')
      // });
      
      let doctors: Doctor[] = [];
      
      // Handle API response structure - check if data is in result.data or direct array
      const data = result.data || result;
      // console.log('Doctor API Response received:', Array.isArray(data) ? data.length : 'undefined', 'doctors');
      
      // Parse the doctor data with rich profile information
      if (data && Array.isArray(data)) {
        doctors = data.map((doctor: any) => ({
          id: doctor.id,
          name: doctor.name || `Doctor ${doctor.id}`,
          specialization: doctor.specialization || doctor.specialty || 'General Practitioner',
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
        // console.log('Parsed doctors:', doctors.map(d => `${d.id}: ${d.name} (${d.specialization})`));
      } else {
        console.log('No doctor data found in API response:', result);
      }
      
      if (doctors.length === 0) {
        console.log('Warning: No doctors parsed from API response');
      }
      
      return doctors;
    } catch (error) {
      console.error('Doctor API Error:', error);
      console.log('Doctor API unavailable - returning empty array');
      return [];
    }
  }

  async getDoctorsByIds(doctorIds: number[]): Promise<Doctor[]> {
    try {
      const allDoctors = await this.getAllDoctors();
      const foundDoctors = allDoctors.filter(doctor => doctorIds.includes(doctor.id));
      
      // If we found all doctors, return them
      if (foundDoctors.length === doctorIds.length) {
        return foundDoctors;
      }
      
      // If some doctors are missing, supplement with fallback data
      const missingIds = doctorIds.filter(id => !foundDoctors.some(d => d.id === id));
      const missingDoctors = allDoctors.filter(doctor => missingIds.includes(doctor.id));
      
      return [...foundDoctors, ...missingDoctors];
    } catch (error) {
      console.log('Doctor API unavailable for IDs:', doctorIds);
      return [];
    }
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
      
      if (!response.ok) {
        if (response.status === 504) {
          console.error('Clinic API Gateway Timeout (504)');
          throw new Error('Clinic API is currently unavailable');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Clinic API Response:', {
        hasData: !!data,
        keys: data ? Object.keys(data) : [],
        success: data?.success,
        hasOrganization: !!data?.organization
      });
      
      if (data && data.success && data.organization) {
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
      console.log('Clinic API unavailable - returning null');
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

// In getSpecificTreatment method, remove any fallback pricing
async getSpecificTreatment(query: string): Promise<HealthcareTreatment | null> {
    try {
        const flatTreatments = await this.getFlatTreatments();
        const treatment = this.findSpecificTreatment(query, flatTreatments);
        
        // Only return treatment if it has a real price from API
        if (treatment && (!treatment.price || treatment.price === '')) {
            console.log(`⚠️ Treatment found but no price available from API: "${treatment.t_name}"`);
            return null; // Don't return treatments without prices
        }
        
        return treatment;
    } catch (error) {
        console.log('API failed for specific treatment:', query);
        return null; // Return null instead of fallback
    }
}

private findSpecificTreatment(query: string, flatTreatments: HealthcareTreatment[]): HealthcareTreatment | null {
    const searchTerms = query.toLowerCase();
    console.log(`🔍 Searching for treatment: "${query}"`);
    
    // Enhanced laser hair removal mapping
    const isLaserHairQuery = searchTerms.includes('laser hair') || 
                             searchTerms.includes('lhr') || 
                             searchTerms.includes('hair laser');
    
    if (isLaserHairQuery) {
        console.log(`🎯 Laser hair query detected - searching specifically`);
        
        // Look for laser hair treatments with priority
        const laserHairTreatments = flatTreatments.filter(treatment => {
            const treatmentName = (treatment.t_name || '').toLowerCase();
            return treatmentName.includes('laser') && treatmentName.includes('hair') ||
                   treatmentName.includes('lhr') ||
                   treatmentName === 'hair laser';
        });
        
        if (laserHairTreatments.length > 0) {
            // Prioritize treatments with "reduction" or "removal" in name
            const preferred = laserHairTreatments.find(t => 
                t.t_name?.toLowerCase().includes('reduction') || 
                t.t_name?.toLowerCase().includes('removal')
            ) || laserHairTreatments[0];
            
            console.log(`✅ Found laser hair treatment: "${preferred.t_name}"`);
            return preferred;
        }
    }
    
    // Rest of your existing matching logic...
    const cleanQuery = searchTerms.replace(/\b(what|is|the|cost|of|price|for|in|treatment|therapy)\b/g, ' ')
                                  .replace(/[^a-z0-9\s]/g, ' ')
                                  .replace(/\s+/g, ' ')
                                  .trim();
    
    // Enhanced treatment mapping
    const treatmentMapping: Record<string, string[]> = {
        'laser hair removal': ['laser hair reduction', 'hair laser', 'lhr', 'laser hair'],
        'lhr': ['laser hair removal', 'laser hair reduction', 'hair laser'],
        'hair laser': ['laser hair removal', 'laser hair reduction', 'lhr'],
        'botox': ['anti wrinkle injection', 'botulinum toxin'],
        'acne treatment': ['acne', 'pimple treatment'],
        // Add more mappings as needed
    };
    
    // Check if query matches any known treatment patterns
    for (const [key, aliases] of Object.entries(treatmentMapping)) {
        if (cleanQuery.includes(key) || aliases.some(alias => cleanQuery.includes(alias))) {
            const targetTreatment = flatTreatments.find(treatment => {
                const treatmentName = (treatment.t_name || '').toLowerCase();
                return treatmentName.includes(key) || aliases.some(alias => treatmentName.includes(alias));
            });
            
            if (targetTreatment) {
                console.log(`✅ Mapped "${cleanQuery}" to treatment: "${targetTreatment.t_name}"`);
                return targetTreatment;
            }
        }
    }
    
    // Fallback to existing matching logic
    const normalize = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    
    return flatTreatments.find(treatment => {
        const treatmentName = normalize(treatment.t_name);
        return treatmentName === cleanQuery || 
               treatmentName.includes(cleanQuery) || 
               cleanQuery.includes(treatmentName);
    }) || null;
}
}

export const healthcareApi = new HealthcareApiService();
