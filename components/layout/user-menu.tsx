"use client";

import { ArrowLeftRight, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { logout } from "@/app/login/actions";
import { forgetThisDevice } from "@/lib/push";
import { UserAvatar } from "@/components/layout/user-avatar";
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

export { initials } from "@/components/layout/user-avatar";

export type ShellUser = { displayName: string; username: string; role: AppRole; avatarPath: string | null };

export function UserMenu({
  user,
  settingsHref,
  switchTo,
}: {
  user: ShellUser;
  settingsHref: string;
  switchTo?: { href: string; label: string };
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("nav.account")}>
          <UserAvatar name={user.displayName} path={user.avatarPath} className="size-9" />
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
