import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Server } from "socket.io";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}

async function socketIoPlugin(fastify: FastifyInstance) {
  const io = new Server(fastify.server, {
    cors: {
      origin: fastify.config.NODE_ENV === "development" ? "*" : undefined,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // JWT authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = await fastify.jwt.verify(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    fastify.log.info({ userId: socket.data.user?.userId }, "Client connected via WebSocket");

    socket.on("disconnect", () => {
      fastify.log.info({ userId: socket.data.user?.userId }, "Client disconnected");
    });
  });

  fastify.decorate("io", io);

  fastify.addHook("onClose", async () => {
    io.close();
  });

  fastify.log.info("Socket.IO initialized with JWT auth");
}

export default fp(socketIoPlugin, { name: "socket-io" });
