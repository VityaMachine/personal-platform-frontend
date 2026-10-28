import { redirect } from "next/navigation";
import { resolveLegacyTasksUrl, type LegacyTaskSearchParams } from "@/modules/tasks/routes";

export default async function Home({ searchParams }: { searchParams: Promise<LegacyTaskSearchParams> }) {
  redirect(resolveLegacyTasksUrl("/", await searchParams)!);
}
