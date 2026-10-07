"use client";

import { ArrowLeftRight, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { logout } from "@/app/login/actions";
import { forgetThisDevice } from "@/lib/push";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppRole } from "@/lib/types";

export type ShellUser = { displayName: string; username: string; role: AppRole };

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function UserMenu({
  user,
  settingsHref,
  switchTo,
}: {
  user: ShellUser;
  settingsHref: string;
  /** Owner only: link to the other side of the app. */
  switchTo?: { href: string; label: string };
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("nav.account")}>
          <Avatar className="size-9">
            <AvatarFallback className="bg-secondary font-bold text-secondary-foreground">
              {initials(user.displayName)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5">
          <span className="truncate text-sm font-bold text-foreground">{user.displayName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            @{user.username} · {t(`roles.${user.role}`)}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {switchTo ? (
            <DropdownMenuItem asChild>
              <Link href={switchTo.href}>
                <ArrowLeftRight aria-hidden="true" />
                {switchTo.label}
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={settingsHref}>
              <Settings aria-hidden="true" />
              {t("nav.settings")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(async () => {
              await forgetThisDevice();
              await logout();
            });
          }}
        >
          <LogOut aria-hidden="true" />
          {pending ? t("nav.loggingOut") : t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
