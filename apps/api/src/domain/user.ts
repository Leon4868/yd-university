export type UserRole = "student" | "teacher" | "merchant" | "admin";

export interface User {
  id: string;
  privyUserId: string;
  username: string;
  avatarUrl: string | null;
  primaryWallet: string | null;
  role: UserRole;
}
