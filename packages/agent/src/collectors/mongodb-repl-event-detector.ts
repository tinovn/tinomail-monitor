/**
 * Detects replica set role transition events by comparing consecutive
 * replSetGetStatus snapshots. Maintains previous member state in memory.
 */

import type { MongodbReplEvent } from "@tinomail/shared";

export interface ReplMemberSnapshot {
  nodeId: string;
  stateStr: string;
}

const DOWN_STATES = new Set(["UNKNOWN", "DOWN", "REMOVED", "ROLLBACK"]);

/**
 * Stateful detector — instantiate once per collector lifecycle.
 * Call detectEvents() after each replSetGetStatus collection.
 */
export class MongodbReplEventDetector {
  private previousStates: Map<string, string> = new Map();

  /**
   * Compare current member states against the previous snapshot.
   * Returns zero or more MongodbReplEvent objects for the current cycle.
   * Updates internal state for the next call.
   */
  detectEvents(currentMembers: ReplMemberSnapshot[]): MongodbReplEvent[] {
    const events: MongodbReplEvent[] = [];
    const now = new Date();
    const currentMap = new Map(currentMembers.map((m) => [m.nodeId, m.stateStr]));

    // Skip detection on first call — no previous state to compare
    if (this.previousStates.size === 0) {
      this.previousStates = currentMap;
      return events;
    }

    let stepUpCount = 0;

    for (const { nodeId, stateStr: newState } of currentMembers) {
      const oldState = this.previousStates.get(nodeId);

      if (oldState === undefined) {
        // New member appeared — not a transition we track
        continue;
      }

      if (oldState === newState) continue;

      const oldIsDown = DOWN_STATES.has(oldState);
      const newIsDown = DOWN_STATES.has(newState);

      if (oldState === "PRIMARY" && !newIsDown) {
        events.push(this.makeEvent(now, nodeId, "step_down", oldState, newState));
      } else if (newState === "PRIMARY" && oldState !== "PRIMARY") {
        stepUpCount++;
        events.push(this.makeEvent(now, nodeId, "step_up", oldState, newState));
      } else if (!oldIsDown && newIsDown) {
        events.push(this.makeEvent(now, nodeId, "member_unreachable", oldState, newState));
      } else if (oldIsDown && !newIsDown) {
        events.push(this.makeEvent(now, nodeId, "member_recovered", oldState, newState));
      }
    }

    // Detect members that disappeared entirely
    for (const [nodeId, oldState] of this.previousStates) {
      if (!currentMap.has(nodeId) && !DOWN_STATES.has(oldState)) {
        events.push(this.makeEvent(now, nodeId, "member_unreachable", oldState, null));
      }
    }

    // If multiple nodes changed to PRIMARY simultaneously → election
    if (stepUpCount > 1) {
      for (const ev of events) {
        if (ev.eventType === "step_up") {
          (ev as { eventType: string }).eventType = "election";
        }
      }
    }

    this.previousStates = currentMap;
    return events;
  }

  private makeEvent(
    time: Date,
    nodeId: string,
    eventType: MongodbReplEvent["eventType"],
    oldRole: string | null,
    newRole: string | null
  ): MongodbReplEvent {
    return { time, nodeId, eventType, oldRole, newRole };
  }
}
