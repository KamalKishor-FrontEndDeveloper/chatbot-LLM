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
  userId: varchar("user_id"),
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

// Chat message types
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
  treatments: z.array(HealthcareTreatmentSchema).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
