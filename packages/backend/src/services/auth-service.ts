import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { dashboardUsers } from "../db/schema/dashboard-users-table.js";

const scryptAsync = promisify(scrypt);

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface LoginResult extends TokenPair {
  user: {
    id: number;
    username: string;
    role: string;
    telegramId: string | null;
    email: string | null;
    createdAt: Date | null;
  };
}

export class AuthService {
  constructor(private app: FastifyInstance) {}

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString("hex")}`;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [salt, key] = hash.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(keyBuffer, derivedKey);
  }

  async generateTokens(userId: number, username: string, role: string): Promise<TokenPair> {
    const payload = { userId, username, role };
    const accessToken = await this.app.jwt.sign(payload, {
      expiresIn: this.app.config.JWT_EXPIRES_IN,
    });

    // Refresh token valid for 7 days
    const refreshToken = await this.app.jwt.sign(payload, {
      expiresIn: "7d",
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.app.config.JWT_EXPIRES_IN,
    };
  }

  async login(username: string, password: string): Promise<LoginResult | null> {
    const [user] = await this.app.db
      .select()
      .from(dashboardUsers)
      .where(eq(dashboardUsers.username, username))
      .limit(1);

    if (!user) {
      return null;
    }

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    const tokens = await this.generateTokens(user.id, user.username, user.role || "viewer");
    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        role: user.role || "viewer",
        telegramId: user.telegramId,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }

  async refreshToken(oldToken: string): Promise<TokenPair | null> {
    try {
      const decoded = await this.app.jwt.verify<{ userId: number; username: string; role: string }>(oldToken);
      return this.generateTokens(decoded.userId, decoded.username, decoded.role);
    } catch {
      return null;
    }
  }
}
