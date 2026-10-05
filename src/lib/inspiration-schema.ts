import { z } from "zod";
// References describe direction only. Permission is an owner declaration, never rights clearance.
export const localImageSchema = z
  .string()
  .max(1_500_000)
  .refine((value) => !value || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value));
export const inspirationSchema = z.object({
  id: z.string().uuid(),
  image: localImageSchema.default(""),
  assetId: z.string().uuid().optional(),
  source: z.string().max(1000).default(""),
  title: z.string().max(120).default(""),
  url: z.string().max(2048).default(""),
  note: z.string().max(600).default(""),
  permission: z.enum(["unknown", "own", "licensed"]).default("unknown"),
});
