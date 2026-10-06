import { updateBrand } from "./brand-preview.ts";
import type { DemoData } from "./quick-start.ts";
import { validateService, type Service } from "./service-catalog.ts";

// Helper to validate YYYY-MM-DD date format and check if it's a valid calendar date
function isValidDate(dateStr: string): boolean {
  // Check format matches YYYY-MM-DD
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }

  try {
    const date = new Date(dateStr + "T00:00:00Z");
    // Check if the date is valid (not NaN) and the formatted date matches input
    const isoDate = date.toISOString().slice(0, 10);
    return !isNaN(date.getTime()) && isoDate === dateStr;
  } catch {
    return false;
  }
}

export function serviceBriefPatch(
  service: Service,
  today: string,
): { offer: string; detail: string; audience: string } | null {
  // Validate the service using the existing validator
  let validatedService: Service;
  try {
    validatedService = validateService(service);
  } catch {
    return null;
  }

  // Require status confirmed and conditionsConfirmed true
  if (validatedService.status !== "confirmed" || !validatedService.conditionsConfirmed) {
    return null;
  }

  // Trim values
  const title = validatedService.title.trim();
  const summary = validatedService.summary.trim();
  const audience = validatedService.audience.trim();
  const conditions = validatedService.conditions;

  // Require trimmed summary >=12 chars, trimmed audience >=3, trimmed title >=3
  if (summary.length < 12 || audience.length < 3 || title.length < 3) {
    return null;
  }

  // Validate today is an actual YYYY-MM-DD calendar date
  if (!isValidDate(today)) {
    return null;
  }

  // A non-empty validUntil before today must return null; today itself is valid
  if (validatedService.validUntil && validatedService.validUntil.trim() !== "") {
    const validUntil = validatedService.validUntil.trim();
    if (!isValidDate(validUntil)) {
      return null;
    }
    if (validUntil < today) {
      return null;
    }
  }

  // detail is the trimmed summary, followed by a blank line and trimmed conditions if non-empty
  let detail = summary;
  if (conditions && conditions.trim() !== "") {
    detail = summary + "\n\n" + conditions.trim();
  }

  // Refuse detail over 600 chars (i.e., length > 600)
  if (detail.length > 600) {
    return null;
  }

  // Refuse audience over 1000, title over 1000
  if (audience.length > 1000 || title.length > 1000) {
    return null;
  }

  // Return only offer/title, detail and audience
  return {
    offer: title,
    detail,
    audience,
  };
}

export function applyServiceToBrief(
  data: DemoData,
  service: Service,
  catalogRevision: string,
  today: string,
): DemoData {
  const patch = serviceBriefPatch(service, today);
  if (!patch)
    throw new Error(
      "Confirme o serviço, as condições e a vigência; use um resumo com condições de até 600 caracteres.",
    );
  return {
    ...data,
    brand: updateBrand(data.brand, {
      serviceBrief: {
        ...patch,
        id: service.id,
        catalogRevision,
        source: service.source,
        validUntil: service.validUntil,
        ...(service.visualMaterial
          ? { visualMaterial: structuredClone(service.visualMaterial) }
          : {}),
      },
    }),
  };
}
