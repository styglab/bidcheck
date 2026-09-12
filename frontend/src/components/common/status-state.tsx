import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function StatusState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return <Card className="border-dashed py-0 shadow-none"><CardContent className="flex flex-col items-center px-5 py-12 text-center"><span className="mb-3 text-muted-foreground">{icon}</span><strong className="text-base text-foreground">{title}</strong>{description && <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}{action && <div className="mt-4">{action}</div>}</CardContent></Card>;
}
