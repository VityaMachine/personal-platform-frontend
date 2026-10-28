export type AreaReference = { id: string; name: string };
export type Area = AreaReference & { createdAt: string; updatedAt: string };
export type AreaInput = { name: string };
