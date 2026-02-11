import { loadConfig } from "./server-config.js";
import { buildApp } from "./app-factory.js";
import { initializeWorkers, shutdownWorkers } from "./workers/worker-registry.js";

async function main() {
  const config = loadConfig();
  const app = await buildApp(config);

  // Initialize BullMQ workers
  const workers = await initializeWorkers(app);

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`Backend listening on ${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    await shutdownWorkers(workers);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down gracefully");
    await shutdownWorkers(workers);
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
