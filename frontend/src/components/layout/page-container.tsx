import type { HTMLAttributes } from "react";
import { cn } from "cn";

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <main className={cn("mx-auto min-h-[calc(100vh-4rem)] w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14", className)} {...props} />;
}
