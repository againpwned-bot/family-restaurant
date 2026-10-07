"use client";

import { Copy, Dices, KeyRound, LoaderCircle, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createUser,
  deleteUser,
  resetPassword,
  updateUser,
  type UserError,
  type UserResult,
} from "@/app/admin/users/actions";
import { initials } from "@/components/layout/user-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KITCHEN_TZ } from "@/lib/dates";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/username";
import type { AppRole } from "@/lib/supabase/database.types";

export type ManagedUser = { id: string; username: string; display_name: string; role: AppRole; created_at: string };
type Dialog = { kind: "add" } | { kind: "edit" | "reset" | "delete"; user: ManagedUser } | null;

const ROLES: AppRole[] = ["client", "admin", "owner"];
const ROLE_TONE: Record<AppRole, string> = {
  owner: "bg-primary text-primary-foreground",
  admin: "bg-gold-soft text-gold-ink",
  client: "bg-secondary text-secondary-foreground",
};

/** Readable random password without look-alike characters. */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function UsersManager({ users, meId }: { users: ManagedUser[]; meId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <Button size="lg" onClick={() => setDialog({ kind: "add" })}>
          <UserPlus aria-hidden="true" />
          {t("adminUsers.add")}
        </Button>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {users.map((user) => {
          const isMe = user.id === meId;
          return (
            <li key={user.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <Avatar className="size-12">
                <AvatarFallback className="bg-secondary font-bold text-secondary-foreground">
                  {initials(user.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">
                  {user.display_name}
                  {isMe ? (
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">({t("adminUsers.you")})</span>
                  ) : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge className={ROLE_TONE[user.role]}>{t(`roles.${user.role}`)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("adminUsers.createdAt")}{" "}
                    {format.dateTime(new Date(user.created_at), {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: KITCHEN_TZ,
                    })}
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("adminUsers.moreActions", { name: user.display_name })}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => setDialog({ kind: "edit", user })}>
                    <Pencil aria-hidden="true" />
                    {t("adminUsers.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDialog({ kind: "reset", user })}>
                    <KeyRound aria-hidden="true" />
                    {t("adminUsers.resetPassword")}
                  </DropdownMenuItem>
                  {!isMe ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ kind: "delete", user })}>
                        <Trash2 aria-hidden="true" />
                        {t("adminUsers.delete")}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

      {dialog?.kind === "add" ? <UserDialog mode="add" onClose={close} /> : null}
      {dialog?.kind === "edit" ? (
        <UserDialog mode="edit" user={dialog.user} isMe={dialog.user.id === meId} onClose={close} />
      ) : null}
      {dialog?.kind === "reset" ? <ResetDialog user={dialog.user} onClose={close} /> : null}
      {dialog?.kind === "delete" ? <DeleteDialog user={dialog.user} onClose={close} /> : null}
    </div>
  );
}

function useErrorText() {
  const t = useTranslations("adminUsers.errors");
  return (error: UserError) => t(error, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH });
}

function PasswordField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const t = useTranslations();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t("adminUsers.password")}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          autoComplete="new-password"
          spellCheck={false}
          autoCapitalize="none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
        />
        <Button type="button" variant="outline" onClick={() => onChange(generatePassword())}>
          <Dices aria-hidden="true" />
          {t("adminUsers.generate")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("common.copy")}
          disabled={!value}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              toast.success(t("common.copied"));
            } catch {
              // clipboard blocked: the password is visible anyway
            }
          }}
        >
          <Copy />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("adminUsers.passwordHint", { min: PASSWORD_MIN_LENGTH })}</p>
    </div>
  );
}

function UserDialog({
  mode,
  user,
  isMe,
  onClose,
}: {
  mode: "add" | "edit";
  user?: ManagedUser;
  isMe?: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [role, setRole] = useState<AppRole>(user?.role ?? "client");
  const [password, setPassword] = useState(mode === "add" ? generatePassword() : "");
  const [error, setError] = useState<UserError | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const result: UserResult =
        mode === "add"
          ? await createUser({ username, displayName: displayName || username, role, password })
          : await updateUser({ id: user!.id, displayName, role });
      if (!result.ok) return setError(result.error);
      toast.success(mode === "add" ? t("adminUsers.created", { username }) : t("adminUsers.saved"));
      onClose();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {mode === "add" ? t("adminUsers.addTitle") : t("adminUsers.editTitle")}
            </DialogTitle>
            {mode === "add" ? <DialogDescription>{t("adminUsers.addDescription")}</DialogDescription> : null}
          </DialogHeader>
          {mode === "add" ? (
            <div className="grid gap-2">
              <Label htmlFor="new-username">{t("adminUsers.username")}</Label>
              <Input
                id="new-username"
                value={username}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={32}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={error === "usernameInvalid" || error === "usernameTaken" || undefined}
              />
              <p className="text-sm text-muted-foreground">{t("adminUsers.usernameHint")}</p>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="user-display-name">{t("adminUsers.name")}</Label>
            <Input
              id="user-display-name"
              value={displayName}
              maxLength={60}
              placeholder={t("adminUsers.displayNamePlaceholder")}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={error === "displayNameRequired" || undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-role">{t("adminUsers.role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)} disabled={isMe}>
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mode === "add" ? <PasswordField id="new-password" value={password} onChange={setPassword} /> : null}
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {errorText(error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {mode === "add" ? t("adminUsers.create") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [password, setPassword] = useState(generatePassword);
  const [error, setError] = useState<UserError | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const result = await resetPassword({ id: user.id, password });
              if (!result.ok) return setError(result.error);
              toast.success(t("adminUsers.resetDone", { name: user.display_name }));
              onClose();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {t("adminUsers.resetTitle", { name: user.display_name })}
            </DialogTitle>
            <DialogDescription>{t("adminUsers.resetText")}</DialogDescription>
          </DialogHeader>
          <PasswordField id="reset-password" value={password} onChange={setPassword} />
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {errorText(error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
              {t("adminUsers.resetConfirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [pending, start] = useTransition();

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("adminUsers.deleteTitle", { name: user.display_name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("adminUsers.deleteText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                const result = await deleteUser({ id: user.id });
                if (!result.ok) {
                  toast.error(errorText(result.error));
                  return onClose();
                }
                toast.success(t("adminUsers.deleted"));
                onClose();
              });
            }}
          >
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {t("adminUsers.deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
