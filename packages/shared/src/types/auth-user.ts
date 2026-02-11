/** Dashboard user roles */
export type UserRole = "admin" | "operator" | "viewer";

/** Dashboard user account */
export interface DashboardUser {
  id: number;
  username: string;
  role: UserRole;
  telegramId: string | null;
  email: string | null;
  createdAt: Date;
}

/** JWT token payload */
export interface JwtPayload {
  sub: number;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/** Saved view / custom dashboard */
export interface SavedView {
  id: number;
  userId: number;
  name: string;
  config: Record<string, unknown>;
  isDefault: boolean;
  createdAt: Date;
}
