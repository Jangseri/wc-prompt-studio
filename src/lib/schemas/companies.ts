import { z } from "zod";
import { channelSchema, identifierSchema, statusSchema } from "./common";

/** Query parameters for GET /api/companies. */
export const companiesQuerySchema = z.object({
  company_seq: identifierSchema.optional(),
  ai_staff_seq: identifierSchema.optional(),
  channel: channelSchema.optional(),
  status: statusSchema.optional(),
});
export type CompaniesQuery = z.infer<typeof companiesQuerySchema>;

export function parseCompaniesQuery(params: URLSearchParams): CompaniesQuery {
  const obj = {
    company_seq: params.get("company_seq") ?? undefined,
    ai_staff_seq: params.get("ai_staff_seq") ?? undefined,
    channel: params.get("channel") ?? undefined,
    status: params.get("status") ?? undefined,
  };
  // zod rejects explicit undefined in strict mode, so strip them
  const cleaned = Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
  return companiesQuerySchema.parse(cleaned);
}
