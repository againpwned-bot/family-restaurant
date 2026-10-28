"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarUrl } from "@/lib/photos";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function UserAvatar({
  name,
  path,
  className,
  fallbackClassName,
}: {
  name: string;
  path: string | null | undefined;
  className?: string;
  fallbackClassName?: string;
}) {
  const src = avatarUrl(path);
  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className={cn("bg-secondary font-bold text-secondary-foreground", fallbackClassName)}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
