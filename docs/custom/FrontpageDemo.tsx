"use client";

import { FC, useCallback } from "react";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProps } from "@xyflow/react";
import { Bleed } from "nextra/components";

const nodeTypes: ReactFlowProps["nodeTypes"] = {
  mutation: (props) => {
    return (
      <div className="react-flow__node-default">
        <Handle type="target" position={Position.Top} style={{ left: "30%" }} />
        <Handle type="source" position={Position.Top} style={{ left: "70%" }} />
        {props.data.label}
      </div>
    );
  },
  query: (props) => {
    return (
      <div className="react-flow__node-default">
        <Handle type="target" position={Position.Top} style={{ left: "30%" }} />
        <Handle type="source" position={Position.Top} style={{ left: "70%" }} />
        {props.data.label}
      </div>
    );
  },
  server: (props) => {
    return (
      <div className="react-flow__node-default">
        {props.data.label}
        <Handle type="source" position={Position.Bottom} style={{ left: "20%" }} id="queryOut" />
        <Handle type="target" position={Position.Bottom} style={{ left: "40%" }} id="queryIn" />
        <Handle type="source" position={Position.Bottom} style={{ left: "60%" }} id="mutationOut" />
        <Handle type="target" position={Position.Bottom} style={{ left: "80%" }} id="mutationIn" />
      </div>
    );
  },
};
export const FrontpageDemo: FC = () => {
  return (
    <Bleed full>
      <div
        style={{
          height: "calc(100vh - var(--nextra-navbar-height) - 11rem);)",
        }}
      >
        <ReactFlow
          nodes={[
            {
              id: "q",
              type: "query",
              position: { x: -150, y: 100 },
              data: { label: "Things" },
            },
            {
              id: "m",
              position: { x: 150, y: 100 },
              type: "mutation",
              data: { label: "Add Thing" },
            },
            {
              id: "s",
              type: "server",
              position: { x: 0, y: -100 },
              data: { label: "Server" },
            },
          ]}
          edges={[
            {
              id: "m->s",
              label: "m->s",
              source: "m",
              target: "s",
              targetHandle: "mutationIn",
              animated: true,
              markerEnd: { type: MarkerType.Arrow, strokeWidth: 5 },
            },
            {
              id: "s->m",
              label: "s->m",
              source: "s",
              target: "m",
              sourceHandle: "mutationOut",
              markerEnd: { type: MarkerType.Arrow },
            },
            {
              id: "q->s",
              label: "q->s",
              source: "q",
              target: "s",
              targetHandle: "queryIn",
            },
            {
              id: "s->q",
              label: "s->q",
              source: "s",
              target: "q",
              sourceHandle: "queryOut",
            },
          ]}
          nodeTypes={nodeTypes}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </Bleed>
  );
};
