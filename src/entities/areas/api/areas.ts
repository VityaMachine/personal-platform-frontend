import { jsonRequest, requestDelete, requestDto } from "../../../shared/api/api";
import type { AreaInput } from "../model/area-types";
import { isArea, isAreaList } from "../model/area-validation";

export type { Area, AreaInput, AreaReference } from "../model/area-types";
const areaPath = (id: string) => `/areas/${encodeURIComponent(id)}`;
export const getAreas = (signal?: AbortSignal) => requestDto("/areas", isAreaList, { signal });
export const createArea = (input: AreaInput, signal?: AbortSignal) => requestDto("/areas", isArea, jsonRequest("POST", input, signal));
export const updateArea = (id: string, input: AreaInput, signal?: AbortSignal) => requestDto(areaPath(id), isArea, jsonRequest("PATCH", input, signal));
export const deleteArea = (id: string, signal?: AbortSignal) => requestDelete(areaPath(id), signal);
