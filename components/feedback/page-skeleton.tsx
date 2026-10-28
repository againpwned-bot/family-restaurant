import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div aria-busy="true" className="animate-in duration-300 fade-in">
      <Skeleton className="mb-3 h-4 w-32" />
      <Skeleton className="mb-8 h-10 w-64 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
