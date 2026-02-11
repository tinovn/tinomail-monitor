import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type postgres from "postgres";
import type { drizzle } from "drizzle-orm/postgres-js";
import { createDb } from "../db/database-client.js";

declare module "fastify" {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle>;
    sql: ReturnType<typeof postgres>;
  }
}

async function databasePlugin(fastify: FastifyInstance) {
  const { db, sql } = createDb(fastify.config.DATABASE_URL);

  fastify.decorate("sql", sql);
  fastify.decorate("db", db);

  fastify.addHook("onClose", async () => {
    await sql.end();
  });

  fastify.log.info("Database connected");
}

export default fp(databasePlugin, { name: "database" });
