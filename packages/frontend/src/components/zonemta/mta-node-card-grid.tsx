import type { MtaNodeStats } from "@tinomail/shared";
import { MtaNodeSummaryCard } from "./mta-node-summary-card";

interface MtaNodeCardGridProps {
  nodes: MtaNodeStats[];
}

export function MtaNodeCardGrid({ nodes }: MtaNodeCardGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
      {nodes.map((node) => (
        <MtaNodeSummaryCard key={node.nodeId} node={node} />
      ))}
    </div>
  );
}
