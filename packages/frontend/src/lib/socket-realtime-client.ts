import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

type EventHandler = (...args: any[]) => void;

/** Socket.IO realtime client singleton */
class SocketRealtimeClient {
  private socket: Socket | null = null;
  private accessToken: string | null = null;
  private subscribedRooms = new Set<string>();

  connect(accessToken: string) {
    if (this.socket?.connected && this.accessToken === accessToken) {
      return;
    }

    this.disconnect();
    this.accessToken = accessToken;

    this.socket = io({
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on("connect", () => {
      console.log("[Socket] Connected");
      // Resubscribe to rooms after reconnect
      this.subscribedRooms.forEach((room) => {
        this.socket?.emit("subscribe", room);
      });
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.subscribedRooms.clear();
      this.socket.disconnect();
      this.socket = null;
    }
    this.accessToken = null;
  }

  subscribe(room: string) {
    if (!this.socket) {
      console.warn("[Socket] Cannot subscribe: not connected");
      return;
    }
    this.subscribedRooms.add(room);
    this.socket.emit("subscribe", room);
  }

  unsubscribe(room: string) {
    if (!this.socket) return;
    this.subscribedRooms.delete(room);
    this.socket.emit("unsubscribe", room);
  }

  on(event: string, handler: EventHandler) {
    if (!this.socket) {
      console.warn("[Socket] Cannot listen: not connected");
      return;
    }
    this.socket.on(event, handler);
  }

  off(event: string, handler?: EventHandler) {
    if (!this.socket) return;
    if (handler) {
      this.socket.off(event, handler);
    } else {
      this.socket.off(event);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketClient = new SocketRealtimeClient();
