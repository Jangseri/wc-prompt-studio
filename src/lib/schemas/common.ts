import { z } from "zod";

/**
 * company_seq / ai_staff_seq shape.
 * Allow alphanumerics, underscore, hyphen. The __TEST__ prefix is valid.
 * Length 1–64. Prevents SQL injection payloads like "'; DROP TABLE..." at
 * the API boundary even though mysql2 prepared statements also bind safely.
 */
export const identifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_\-]+$/, "must contain only letters, digits, _ or -");

/** svc_cd / prmt_cd: 2 letters + 4 digits (e.g. SA1000, PD2000). */
export const codeSchema = z.string().regex(/^[A-Z]{2}\d{4}$/);

/** status column: 'Y' or 'N'. */
export const statusSchema = z.enum(["Y", "N"]);

/** channel used by the unified workspace. */
export const channelSchema = z.enum(["callbot", "chatbot"]);

/**
 * Optional json_schema string. Either null or a string that must parse as JSON.
 * Accept empty string as null (frontend sometimes sends "").
 */
export const jsonSchemaField = z
  .union([z.string(), z.null()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v == null) return null;
    if (v === "") return null;
    return v;
  })
  .refine(
    (v) => {
      if (v == null) return true;
      try {
        JSON.parse(v);
        return true;
      } catch {
        return false;
      }
    },
    { message: "json_schema must be valid JSON or null" }
  );
