import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/Button";

interface UserMenuProps {
  userLabel: string;
}

export function UserMenu({ userLabel }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[12rem] truncate text-xs text-muted sm:block">
        Signed in as <span className="font-medium text-white">{userLabel}</span>
      </span>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm">
          Sign Out
        </Button>
      </form>
    </div>
  );
}
