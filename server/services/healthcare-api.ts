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
        if (response.status === 504) {
          console.error('Doctor API Gateway Timeout (504)');
          throw new Error('Doctor API is currently unavailable');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Doctor API Response received:', {
        hasData: !!result.data,
        isDirectArray: Array.isArray(result),
        resultKeys: Object.keys(result || {}),
        dataLength: Array.isArray(result) ? result.length : (Array.isArray(result.data) ? result.data.length : 'not array')
      });
      
      let doctors: Doctor[] = [];
      
      // Handle API response structure - check if data is in result.data or direct array
      const data = result.data || result;
      console.log('Doctor API Response received:', Array.isArray(data) ? data.length : 'undefined', 'doctors');
      
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
        console.log('Parsed doctors:', doctors.map(d => `${d.id}: ${d.name} (${d.specialization})`));
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

  // Enhanced method to get specific treatment (no related items)
  async getSpecificTreatment(query: string): Promise<HealthcareTreatment | null> {
    try {
      const flatTreatments = await this.getFlatTreatments();
      return this.findSpecificTreatment(query, flatTreatments);
    } catch (error) {
      console.log('API failed for specific treatment:', query);
      return null;
    }
  }

  private findSpecificTreatment(query: string, flatTreatments: HealthcareTreatment[]): HealthcareTreatment | null {
    const searchTerms = query.toLowerCase();
    console.log(`🔍 Searching for treatment: "${query}" (normalized: "${searchTerms}")`);
    
    // Log available treatments for debugging
    console.log(`📋 Available treatments (${flatTreatments.length}):`, 
      flatTreatments.slice(0, 10).map(t => t.t_name).join(', '));

    // Remove common words and non-alphanumeric characters, normalize whitespace
    let cleanQuery = searchTerms.replace(/\b(what|is|the|cost|of|price|for|in|treatment|therapy)\b/g, ' ');
    cleanQuery = cleanQuery.replace(/[^a-z0-9\s]/g, ' ');
    cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();
    const compactClean = cleanQuery.replace(/\s+/g, '');
    
    console.log(`🧹 Cleaned query: "${cleanQuery}" (compact: "${compactClean}")`);
    
    // Special priority handling for LHR queries
    if (compactClean === 'lhr' || cleanQuery === 'lhr') {
      console.log(`🎯 LHR query detected - prioritizing laser hair treatments`);
      
      // First try to find exact "laser hair reduction" match
      let lhrMatch = flatTreatments.find(treatment => {
        const treatmentName = treatment.t_name?.toLowerCase() || '';
        return treatmentName.includes('laser hair reduction') || 
               treatmentName.includes('laser hair removal') ||
               treatmentName.includes('laser hair');
      });
      
      if (lhrMatch) {
        console.log(`✅ Found LHR treatment: "${lhrMatch.t_name}"`);
        return lhrMatch;
      }
    }
      
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
      
      if (exactMatch) {
        console.log(`✅ Found exact match: "${exactMatch.t_name}"`);
        return exactMatch;
      }
      
      // Try alias matching
      if (!exactMatch) {
        console.log(`🔍 Trying alias matching for: "${cleanQuery}"`);
        for (const [key, aliases] of Object.entries(treatmentAliases)) {
          const normKey = key.toLowerCase().replace(/\s+/g, '');
          if (compactClean === normKey || cleanQuery === key) {
            console.log(`🎯 Found alias key: "${key}" with aliases: [${aliases.join(', ')}]`);
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
              console.log(`✅ Found treatment via alias: "${exactMatch.t_name}" for query: "${key}"`);
              break;
            }
          }
        }
      }
      
      // Fallback: partial match
      if (!exactMatch) {
        console.log(`🔍 Trying fallback partial matching for: "${cleanQuery}"`);
        exactMatch = flatTreatments.find(treatment => {
          const treatmentName = treatment.t_name?.toLowerCase() || '';
          return treatmentName.includes(cleanQuery) || cleanQuery.includes(treatmentName);
        });
        
        if (exactMatch) {
          console.log(`⚠️ Found fallback match: "${exactMatch.t_name}" (may not be accurate)`);
        }
      }
      
      if (!exactMatch) {
        console.log(`❌ No treatment found for query: "${query}"`);
      }
      
      return exactMatch || null;
  }
}

export const healthcareApi = new HealthcareApiService();
