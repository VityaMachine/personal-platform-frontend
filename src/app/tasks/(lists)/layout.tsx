import type { ReactNode } from "react";
import { TasksScreen } from "@/modules/tasks/screens";

// One client workspace survives all four list routes. It reads live pathname/search.
export default function TaskListsLayout({ children }: { children: ReactNode }) {
  return <><TasksScreen />{children}</>;
}
