import { useState, type FormEvent } from 'react';
import { Star, Trash2, Pencil, Check, X } from 'lucide-react';
import type { User } from '@habitsapp/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserContext } from './UserContext';
import { useCreateUser, useDeleteUser, useUpdateUser } from './queries';

export function UsersSection() {
  const { users, isLoading } = useUserContext();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [newName, setNewName] = useState('');

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createUser.mutate({ name }, { onSuccess: () => setNewName('') });
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Users</h2>
        <p className="text-sm text-ink-soft">
          Names that can log habits. The default user is pre-selected when logging.
        </p>
      </header>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New user name"
          aria-label="New user name"
        />
        <Button type="submit" disabled={createUser.isPending || !newName.trim()}>
          Add
        </Button>
      </form>

      {isLoading && <p className="text-sm text-ink-soft">Loading…</p>}

      {!isLoading && users.length === 0 && (
        <p className="text-sm text-ink-soft">No users yet. Add one above to get started.</p>
      )}

      <ul className="divide-y divide-hairline rounded-md border border-hairline bg-card">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            onSetDefault={() => updateUser.mutate({ id: user.id, isDefault: true })}
            onRename={(name) => updateUser.mutate({ id: user.id, name })}
            onDelete={() => deleteUser.mutate(user.id)}
            renameDisabled={updateUser.isPending}
            deleteDisabled={deleteUser.isPending || users.length <= 1}
            deleteDisabledReason={users.length <= 1 ? 'At least one user is required' : undefined}
          />
        ))}
      </ul>
    </section>
  );
}

type UserRowProps = {
  user: User;
  onSetDefault: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  renameDisabled: boolean;
  deleteDisabled: boolean;
  deleteDisabledReason?: string;
};

function UserRow({
  user,
  onSetDefault,
  onRename,
  onDelete,
  renameDisabled,
  deleteDisabled,
  deleteDisabledReason,
}: UserRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user.name);

  const submit = () => {
    const name = draft.trim();
    if (!name || name === user.name) {
      setEditing(false);
      setDraft(user.name);
      return;
    }
    onRename(name);
    setEditing(false);
  };

  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
              setEditing(false);
              setDraft(user.name);
            }
          }}
          aria-label={`Rename ${user.name}`}
        />
      ) : (
        <span className="flex items-center gap-2 truncate">
          <span className="truncate">{user.name}</span>
          {user.isDefault && (
            <span className="inline-flex items-center gap-1 rounded-full bg-clay/15 px-2 py-0.5 text-xs font-medium text-clay">
              <Star className="h-3 w-3" />
              Default
            </span>
          )}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {editing ? (
          <>
            <Button size="icon" variant="ghost" onClick={submit} aria-label="Save name" disabled={renameDisabled}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraft(user.name);
              }}
              aria-label="Cancel rename"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            {!user.isDefault && (
              <Button size="icon" variant="ghost" onClick={onSetDefault} aria-label={`Set ${user.name} as default`}>
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={`Rename ${user.name}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              aria-label={`Delete ${user.name}`}
              disabled={deleteDisabled}
              title={deleteDisabledReason}
              className="text-ember hover:text-ember/80"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
