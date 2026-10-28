import { redirect } from "next/navigation";
import { resolveLegacyTasksUrl, type LegacyTaskSearchParams } from "@/modules/tasks/routes";

export default async function RoutinesPage({ searchParams }: { searchParams: Promise<LegacyTaskSearchParams> }) {
  redirect(resolveLegacyTasksUrl("/routines", await searchParams)!);
}
