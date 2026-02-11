import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { sendingIps } from "../db/schema/sending-ips-table.js";
import type { SendingIp } from "@tinomail/shared";

export class IpService {
  constructor(private app: FastifyInstance) {}

  async getIps(): Promise<SendingIp[]> {
    const result = await this.app.db.select().from(sendingIps);
    return result as SendingIp[];
  }

  async getIpByAddress(ip: string): Promise<SendingIp | null> {
    const [result] = await this.app.db
      .select()
      .from(sendingIps)
      .where(eq(sendingIps.ip, ip))
      .limit(1);
    return result ? (result as SendingIp) : null;
  }

  async updateIpStatus(
    ip: string,
    status: string,
    notes?: string,
  ): Promise<SendingIp | null> {
    const updateData: { status: string; updatedAt: Date; notes?: string } = {
      status,
      updatedAt: new Date(),
    };
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const [updated] = await this.app.db
      .update(sendingIps)
      .set(updateData)
      .where(eq(sendingIps.ip, ip))
      .returning();
    return updated ? (updated as SendingIp) : null;
  }

  async bulkUpdateStatus(
    ips: string[],
    status: string,
    notes?: string,
  ): Promise<number> {
    if (ips.length === 0) return 0;

    const updateData: { status: string; updatedAt: Date; notes?: string } = {
      status,
      updatedAt: new Date(),
    };
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const result = await this.app.db
      .update(sendingIps)
      .set(updateData)
      .where(inArray(sendingIps.ip, ips))
      .returning();

    return result.length;
  }
}
