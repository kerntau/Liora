import * as React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { ExplorationGraph } from "@/components/exploration-graph";
import { api } from "@/lib/api";
import type { Edge, TaskNode } from "@/lib/types";
export function GraphTab({ taskId }: { taskId: string }) { const [nodes, setNodes] = React.useState<TaskNode[]>([]); const [edges, setEdges] = React.useState<Edge[]>([]); const sigRef = React.useRef(""); React.useEffect(() => { let cancelled = false; sigRef.current = ""; const load = () => { api.explorationGraph(taskId).then((g) => { if (cancelled) return; const ns = g.nodes ?? []; const es = g.edges ?? []; const sig = JSON.stringify([ns.map((n) => [n.id, n.type, n.state, n.priority, n.payload]), es.map((e) => [e.src, e.dst, e.rel])]); if (sig === sigRef.current) return; sigRef.current = sig; setNodes(ns); setEdges(es); }).catch(() => {}); }; load(); const timer = setInterval(load, 20000); return () => { cancelled = true; clearInterval(timer); }; }, [taskId]); return <Card variant="outlined"><CardContent sx={{ p: 0 }}><ExplorationGraph nodes={nodes} edges={edges} className="h-[72vh]" /></CardContent></Card>; }
