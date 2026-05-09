// Shared types between backend and frontend.
// Will grow with each slice.

export type HealthResponse = {
  ok: boolean;
};

export type User = {
  id: number;
  name: string;
  isDefault: boolean;
  createdAt: string;
};

export type CreateUserBody = {
  name: string;
};

export type UpdateUserBody = {
  name?: string;
  isDefault?: boolean;
};
