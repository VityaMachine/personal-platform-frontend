import type { Area, AreaReference } from "./area-types";

export const isAreaId = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function isAreaReference(value: unknown): value is AreaReference {
  return typeof value === "object" && value !== null && "id" in value && isAreaId(value.id)
    && "name" in value && typeof value.name === "string" && value.name.trim().length > 0 && value.name.length <= 80;
}

function timestamp(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function isArea(value: unknown): value is Area {
  return isAreaReference(value) && "createdAt" in value && timestamp(value.createdAt)
    && "updatedAt" in value && timestamp(value.updatedAt);
}
export const isAreaList = (value: unknown): value is Area[] => Array.isArray(value) && value.every(isArea);

export function areaNameError(value: string): string | undefined {
  const name = value.trim();
  if (!name) return "Введіть назву сфери.";
  if (name.length > 80) return "Назва сфери має містити не більше 80 символів.";
}
