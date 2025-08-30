import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  messages: jsonb("messages").notNull().default('[]'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  userId: true,
  messages: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;

// Healthcare API types
export const HealthcareTreatmentSchema = z.object({
  id: z.number(),
  parent_id: z.number(),
  price: z.string(),
  doctors: z.string(),
  t_name: z.string(),
  name: z.string(),
  children: z.array(z.any()).optional(),
  doctorNames: z.array(z.string()).optional(),
  doctorCount: z.number().optional(),
});

export const HealthcareApiResponseSchema = z.object({
  statusCode: z.number(),
  data: z.object({
    success: z.boolean(),
    data: z.array(HealthcareTreatmentSchema),
  }),
});

export type HealthcareTreatment = z.infer<typeof HealthcareTreatmentSchema>;
export type HealthcareApiResponse = z.infer<typeof HealthcareApiResponseSchema>;

// Doctor types
export const DoctorSchema = z.object({
  id: z.number(),
  name: z.string(),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  about: z.string().optional(),
  image: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  services: z.string().optional(),
  is_available: z.boolean().optional(),
});

export type Doctor = z.infer<typeof DoctorSchema>;

// Clinic info types
export const ClinicInfoSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  working_hours: z.string().optional(),
  services: z.array(z.string()).optional(),
});

export type ClinicInfo = z.infer<typeof ClinicInfoSchema>;

// Appointment booking types
export const AppointmentBookingSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  date: z.string(),
  service: z.string(),
  clinic_location_id: z.number().optional(),
  message: z.string().optional(),
  app_source: z.string().optional(),
});

export type AppointmentBooking = z.infer<typeof AppointmentBookingSchema>;

// Chat message types
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
  treatments: z.array(HealthcareTreatmentSchema).optional(),
  doctors: z.array(DoctorSchema).optional(),
  clinic_info: ClinicInfoSchema.optional(),
  intent: z.string().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;