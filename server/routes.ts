import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { openAIService } from "./services/openai";
import { healthcareApi } from "./services/healthcare-api";

const ChatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  sessionId: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, sessionId } = ChatRequestSchema.parse(req.body);
      
      const response = await openAIService.processHealthcareQuery(message);
      
      res.json({
        success: true,
        data: {
          message: response.message,
          treatments: response.treatments,
          intent: response.intent,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error("Chat API Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error"
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
        error: error instanceof Error ? error.message : "Failed to search treatments"
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
        error: error instanceof Error ? error.message : "Failed to fetch pricing information"
      });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
