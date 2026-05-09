import { Check, ChevronDown, UserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUserContext } from './UserContext';

export function UserSwitcher() {
  const { users, activeUser, setActiveUserId } = useUserContext();

  if (users.length < 2 || !activeUser) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch user"
          className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium hover:bg-neutral-100"
        >
          <UserRound className="h-4 w-4" />
          <span className="max-w-[8rem] truncate">{activeUser.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {users.map((user) => (
          <DropdownMenuItem
            key={user.id}
            onSelect={() => setActiveUserId(user.id)}
            className="flex items-center justify-between gap-3"
          >
            <span className="truncate">{user.name}</span>
            {user.id === activeUser.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
