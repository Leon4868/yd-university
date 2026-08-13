import { randomUUID } from "node:crypto";

import type { User, UserRole } from "../domain/user.js";
import { MockDataStore } from "./mock-store.js";
import type { ProvisionUserInput, UserRepository } from "./user-repository.js";

export class MockUserRepository implements UserRepository {
  private readonly store: MockDataStore;

  constructor(store: MockDataStore = new MockDataStore()) {
    this.store = store;
  }

  async findByPrivyUserId(privyUserId: string): Promise<User | null> {
    const user = this.store.users.find((item) => item.privyUserId === privyUserId);
    return user ? { ...user } : null;
  }

  async provision(input: ProvisionUserInput): Promise<User> {
    const existing = this.store.users.find((item) => item.privyUserId === input.privyUserId);
    if (existing) {
      return { ...existing };
    }
    const created: User = {
      id: randomUUID(),
      privyUserId: input.privyUserId,
      username: input.username,
      avatarUrl: null,
      primaryWallet: input.primaryWallet,
      role: "student",
    };
    this.store.users.push(created);
    return { ...created };
  }

  async setRole(userId: string, role: UserRole): Promise<User> {
    const user = this.store.users.find((item) => item.id === userId);
    if (!user) {
      throw new Error("setRole 未找到用户");
    }
    user.role = role;
    return { ...user };
  }

  async updatePrimaryWallet(userId: string, primaryWallet: string): Promise<User> {
    const user = this.store.users.find((item) => item.id === userId);
    if (!user) throw new Error("updatePrimaryWallet 未找到用户");
    user.primaryWallet = primaryWallet;
    return { ...user };
  }
}
