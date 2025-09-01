import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { mistralService } from "./services/mistral";
import { healthcareApi } from "./services/healthcare-api";
import { tavilyService } from "./services/tavily";
import { citrineContentService } from "./services/citrine-content";
import { sanitizeForOutput } from "./utils/sanitizer";

const ChatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  sessionId: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, sessionId } = ChatRequestSchema.parse(req.body);
      
      const response = await mistralService.processHealthcareQuery(message);
      
      res.json({
        success: true,
        data: {
          message: sanitizeForOutput(response.message),
          treatments: response.treatments,
          intent: response.intent,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error("Chat API Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? sanitizeForOutput(error.message) : "Internal server error"
      });
    }
  });

  // Get all treatments
  app.get("/api/treatments", async (req, res) => {
    try {
      const treatments = await healthcareApi.getAllTreatments();
      res.json({
        success: true,
        data: treatments
      });
    } catch (error) {
      console.error("Treatments API Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch treatments"
      });
    }
  });

  // Search treatments
  app.get("/api/treatments/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({
          success: false,
          error: "Query parameter 'q' is required"
        });
      }

      const treatments = await healthcareApi.searchTreatments(query);
      res.json({
        success: true,
        data: treatments
      });
    } catch (error) {
      console.error("Treatment Search API Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? sanitizeForOutput(error.message) : "Failed to search treatments"
      });
    }
  });

  // Get treatments with pricing
  app.get("/api/treatments/pricing", async (req, res) => {
    try {
      const treatments = await healthcareApi.getTreatmentsByPrice();
      res.json({
        success: true,
        data: treatments
      });
    } catch (error) {
      console.error("Pricing API Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? sanitizeForOutput(error.message) : "Failed to fetch pricing information"
      });
    }
  });

  // Get all doctors
  app.get("/api/doctors", async (req, res) => {
    try {
      const doctors = await healthcareApi.getAllDoctors();
      res.json({
        success: true,
        data: doctors
      });
    } catch (error) {
      console.error("Doctors API Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? sanitizeForOutput(error.message) : "Failed to fetch doctors"
      });
    }
  });

  // Web content extraction
  app.post("/api/extract", async (req, res) => {
    try {
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({
          success: false,
          error: "URLs array is required"
        });
      }

      const content = await tavilyService.extractContent(urls);
      res.json({
        success: true,
        data: content
      });
    } catch (error) {
      console.error("Extract API Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to extract content"
      });
    }
  });

  // Dynamic greeting generated from Citrine content
  app.get('/api/greeting', async (req, res) => {
    try {
      const mdContent = await citrineContentService.getCitrineContent();

      // Small heuristic extraction for greeting pieces
      const doctorMatch = mdContent.match(/dr\.?\s*niti\s*gaur/i);
      const doctorLine = doctorMatch ? 'Led by Dr. Niti Gaur, MD (Dermatology).' : '';

      const candidateServices = [
        'Hydrafacial MD', 'Chemical Peels', 'Laser Hair Reduction', 'Dermal Fillers',
        'Anti Wrinkle Injection', 'Microneedling', 'HIFU', 'Photofacial', 'Tattoo Removal',
        'Acne Treatment', 'Pigmentation Treatment', 'Hair Loss Treatment', 'Body Contouring'
      ];

      const foundServices = candidateServices.filter(s => mdContent.toLowerCase().includes(s.toLowerCase()));
      const servicesSnippet = foundServices.length > 0 ? foundServices.slice(0,5).join(', ') : 'advanced dermatology and aesthetic treatments';

      const message = `Welcome to Citrine Clinic — where dermatology expertise meets aesthetics. ${doctorLine} We offer ${servicesSnippet}. How can I assist you today with treatments, pricing, or appointments?`;

      res.json({ success: true, data: { message } });
    } catch (error) {
      console.error('Greeting generation failed:', error);
      res.json({ success: true, data: { message: "Welcome to Citrine Clinic. How can I help you today?" } });
    }
  });

  // Search and extract
  app.get("/api/search-extract", async (req, res) => {
    try {
      const { q, maxResults } = req.query;
      if (!q) {
        return res.status(400).json({
          success: false,
          error: "Query parameter 'q' is required"
        });
      }

      const content = await tavilyService.searchAndExtract(
        q as string, 
        maxResults ? parseInt(maxResults as string) : 3
      );
      res.json({
        success: true,
        data: content
      });
    } catch (error) {
      console.error("Search Extract API Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search and extract content"
      });
    }
  });

  // Book appointment
  app.post("/api/appointments/book", async (req, res) => {
    try {
      const appointmentSchema = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Valid email is required"),
        phone: z.string().min(10, "Valid phone number is required"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
        service: z.string().min(1, "Service type is required"),
        message: z.string().optional(),
        clinic_location_id: z.number().optional(),
        app_source: z.string().optional()
      });

      const appointmentData = appointmentSchema.parse(req.body);
      const result = await healthcareApi.bookAppointment(appointmentData);

      res.json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      console.error("Appointment Booking API Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? sanitizeForOutput(error.message) : "Failed to book appointment"
      });
    }
  });

  // API Health Check
  app.get("/api/health", async (req, res) => {
    try {
      const healthStatus = {
        server: "OK",
        timestamp: new Date().toISOString(),
        apis: {
          treatments: "Unknown",
          doctors: "Unknown",
          clinic: "Unknown"
        }
      };

      // Test treatments API
      try {
        const treatments = await healthcareApi.getAllTreatments();
        healthStatus.apis.treatments = treatments.length > 0 ? "OK" : "Empty";
      } catch (error) {
        healthStatus.apis.treatments = "Failed";
      }

      // Test doctors API
      try {
        const doctors = await healthcareApi.getAllDoctors();
        healthStatus.apis.doctors = doctors.length > 0 ? "OK" : "Empty";
      } catch (error) {
        healthStatus.apis.doctors = "Failed";
      }

      // Test clinic API
      try {
        const clinic = await healthcareApi.getClinicInfo();
        healthStatus.apis.clinic = clinic ? "OK" : "Empty";
      } catch (error) {
        healthStatus.apis.clinic = "Failed";
      }

      res.json({
        success: true,
        data: healthStatus
      });
    } catch (error) {
      console.error("Health Check Error:", error);
      res.status(500).json({
        success: false,
        error: "Health check failed"
      });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
