import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page template: the ONE place that defines how wide a page is and how far it
 * sits from the sidebar / navbar. Values match the Fleet Management reference.
 * Pages must not set their own max-width or horizontal padding.
 *
 *   <main className="flex-1 mt-25 pb-20">   // vertical offset under the fixed navbar only
 *     <PageContainer> … </PageContainer>    // or width="narrow" for form pages
 *   </main>
 */
export const PAGE_WIDTH = {
  wide: "max-w-7xl", // tables, lists, dashboards
  narrow: "max-w-4xl", // single-column forms
} as const;

export type PageWidth = keyof typeof PAGE_WIDTH;

export function pageContainer(opts: { width?: PageWidth; className?: string } = {}) {
  return cn("w-full px-2 sm:px-4 pt-5 pb-4", PAGE_WIDTH[opts.width ?? "wide"], opts.className);
}

export function PageContainer({
  width,
  className,
  children,
}: {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}) {
  return <div className={pageContainer({ width, className })}>{children}</div>;
}