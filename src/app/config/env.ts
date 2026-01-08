/* eslint-disable no-console */
import z from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("7d"),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  BCRYPT_SALT_ROUND: z.coerce.number().default(10),
  
  // Stripe Configuration
  STRIPE_SECRET_KEY: z.string().min(1, "Stripe secret key is required"),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1, "Stripe publishable key is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "Stripe webhook secret is required"),
  
  // Email Configuration
  EMAIL: z.string().email("Valid email is required"),
  APP_PASS: z.string().min(1, "App password is required"),
  RESET_PASS_LINK: z.string().url().default("http://localhost:3000/reset-password"),
  RESET_PASS_TOKEN: z.string().default("asdfasdfasdf"),
  RESET_PASS_TOKEN_EXPIRES_IN: z.string().default("5m"),
  
  // Application URLs
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  BACKEND_URL: z.string().url().default("http://localhost:5000"),
  
  // Email Templates (optional)
  EMAIL_FROM_NAME: z.string().default("Tour Booking System"),
  EMAIL_SUBJECT_PREFIX: z.string().default("[Tour Booking] "),
  
  // Email Service Configuration
  EMAIL_SERVICE: z.enum(["gmail", "smtp"]).default("gmail"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

const env = envSchema.safeParse(process.env);

if (!env.success) {
  console.error("❌ Invalid environment variables:", JSON.stringify(env.error.format(), null, 2));
  throw new Error("Invalid environment variables");
}

const envVars = env.data;

// Validate email configuration based on service
if (envVars.EMAIL_SERVICE === "gmail") {
  if (!envVars.EMAIL || !envVars.APP_PASS) {
    console.error("❌ Gmail email configuration requires EMAIL and APP_PASS");
    throw new Error("Invalid email configuration for Gmail");
  }
} else if (envVars.EMAIL_SERVICE === "smtp") {
  if (!envVars.SMTP_HOST || !envVars.SMTP_PORT || !envVars.SMTP_USER || !envVars.SMTP_PASS) {
    console.error("❌ SMTP configuration requires SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS");
    throw new Error("Invalid SMTP configuration");
  }
}

export default envVars;