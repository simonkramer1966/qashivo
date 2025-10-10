import { useState, useCallback, useRef, DragEvent } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Handle,
  Position,
  NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  DollarSign,
  Mail,
  MessageSquare,
  Phone,
  Timer,
  Bot,
  Save,
  X,
} from "lucide-react";
import type { CollectionSchedule, InsertCollectionSchedule } from "@shared/schema";

interface VisualWorkflowBuilderProps {
  initialWorkflow?: CollectionSchedule;
  onSave?: (workflow: Partial<InsertCollectionSchedule>) => void;
}

interface NodeData extends Record<string, unknown> {
  label: string;
  type: string;
  config?: {
    delay?: number;
    delayUnit?: "hours" | "days" | "weeks";
    templateId?: string;
    timeout?: number;
    intentType?: string;
    threshold?: number;
  };
}

// Custom Node Components
const TriggerNode = ({ data, selected }: NodeProps) => {
  const nodeData = data as NodeData;
  return (
    <div className={`px-4 py-3 rounded-lg border-2 bg-blue-50 border-blue-300 min-w-[180px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="flex items-center gap-2">
        {nodeData.type === 'invoice_overdue' ? (
          <Clock className="h-5 w-5 text-blue-600" />
        ) : (
          <DollarSign className="h-5 w-5 text-blue-600" />
        )}
        <div className="font-medium text-sm text-blue-900">{nodeData.label}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};

const ActionNode = ({ data, selected }: NodeProps) => {
  const nodeData = data as NodeData;
  
  const getIcon = () => {
    switch (nodeData.type) {
      case 'send_email':
        return <Mail className="h-5 w-5 text-teal-600" />;
      case 'send_sms':
        return <MessageSquare className="h-5 w-5 text-teal-600" />;
      case 'voice_call':
        return <Phone className="h-5 w-5 text-teal-600" />;
      case 'wait_delay':
        return <Timer className="h-5 w-5 text-teal-600" />;
      default:
        return <Mail className="h-5 w-5 text-teal-600" />;
    }
  };

  return (
    <div className={`px-4 py-3 rounded-lg border-2 bg-teal-50 border-teal-300 min-w-[180px] ${selected ? 'ring-2 ring-teal-500' : ''}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="flex items-center gap-2">
        {getIcon()}
        <div className="font-medium text-sm text-teal-900">{nodeData.label}</div>
      </div>
      {nodeData.config?.delay && (
        <div className="text-xs text-teal-700 mt-1">
          Delay: {nodeData.config.delay} {nodeData.config.delayUnit}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};

const LogicNode = ({ data, selected }: NodeProps) => {
  const nodeData = data as NodeData;
  const isIntentRouter = nodeData.type === 'intent_router';

  return (
    <div className={`px-4 py-3 rounded-lg border-2 bg-purple-50 border-purple-300 min-w-[200px] ${selected ? 'ring-2 ring-purple-500' : ''}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="flex items-center gap-2">
        {nodeData.type === 'wait_for_response' ? (
          <>
            <Clock className="h-4 w-4 text-purple-600" />
            <MessageSquare className="h-4 w-4 text-purple-600" />
          </>
        ) : (
          <Bot className="h-5 w-5 text-purple-600" />
        )}
        <div className="font-medium text-sm text-purple-900">{nodeData.label}</div>
      </div>
      {nodeData.config?.timeout && (
        <div className="text-xs text-purple-700 mt-1">
          Timeout: {nodeData.config.timeout}h
        </div>
      )}
      {isIntentRouter ? (
        <>
          <Handle type="source" position={Position.Bottom} id="payment_plan" className="w-3 h-3" style={{ left: '20%' }} />
          <Handle type="source" position={Position.Bottom} id="dispute" className="w-3 h-3" style={{ left: '35%' }} />
          <Handle type="source" position={Position.Bottom} id="promise_to_pay" className="w-3 h-3" style={{ left: '50%' }} />
          <Handle type="source" position={Position.Bottom} id="general_query" className="w-3 h-3" style={{ left: '65%' }} />
          <Handle type="source" position={Position.Bottom} id="unknown" className="w-3 h-3" style={{ left: '80%' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      )}
    </div>
  );
};

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  logic: LogicNode,
};

// Palette node types
const paletteNodes = [
  {
    category: "Triggers",
    nodes: [
      { id: 'invoice_overdue', label: 'Invoice Overdue', icon: Clock, type: 'trigger', color: 'blue' },
      { id: 'balance_threshold', label: 'Balance Threshold', icon: DollarSign, type: 'trigger', color: 'blue' },
    ],
  },
  {
    category: "Actions",
    nodes: [
      { id: 'send_email', label: 'Send Email', icon: Mail, type: 'action', color: 'teal' },
      { id: 'send_sms', label: 'Send SMS', icon: MessageSquare, type: 'action', color: 'teal' },
      { id: 'voice_call', label: 'Voice Call', icon: Phone, type: 'action', color: 'teal' },
      { id: 'wait_delay', label: 'Wait/Delay', icon: Timer, type: 'action', color: 'teal' },
    ],
  },
  {
    category: "Logic",
    nodes: [
      { id: 'wait_for_response', label: 'Wait for Response', icon: MessageSquare, type: 'logic', color: 'purple' },
      { id: 'intent_router', label: 'Intent Router', icon: Bot, type: 'logic', color: 'purple' },
    ],
  },
];

export default function VisualWorkflowBuilder({ initialWorkflow, onSave }: VisualWorkflowBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Handle connection between nodes
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle drag over
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const nodeData = event.dataTransfer.getData('application/reactflow');
      if (!nodeData) return;

      const { id, label, type } = JSON.parse(nodeData);
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node<NodeData> = {
        id: `${id}-${Date.now()}`,
        type,
        position,
        data: { 
          label, 
          type: id,
          config: {
            delay: id === 'wait_delay' ? 24 : 0,
            delayUnit: 'hours' as const,
          },
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  // Handle node click
  const onNodeClick = useCallback((_event: any, node: Node<NodeData>) => {
    setSelectedNode(node);
  }, []);

  // Update node configuration
  const updateNodeConfig = useCallback((config: any) => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              config: { ...node.data.config, ...config },
            },
          };
        }
        return node;
      })
    );
  }, [selectedNode, setNodes]);

  // Convert React Flow to schedule steps
  const convertToScheduleSteps = useCallback(() => {
    const steps = nodes
      .filter(node => node.data.type !== 'invoice_overdue' && node.data.type !== 'balance_threshold')
      .map((node, index) => ({
        id: node.id,
        order: index + 1,
        type: node.data.type === 'send_email' ? 'email' as const : 
              node.data.type === 'send_sms' ? 'sms' as const :
              node.data.type === 'voice_call' ? 'call' as const :
              node.data.type === 'wait_delay' ? 'wait' as const : 'email' as const,
        delay: node.data.config?.delay || 0,
        delayUnit: node.data.config?.delayUnit || 'hours' as const,
        templateId: node.data.config?.templateId,
        conditions: [],
      }));

    return steps;
  }, [nodes]);

  // Save workflow
  const handleSave = useCallback(() => {
    const scheduleSteps = convertToScheduleSteps();
    const workflowData = {
      scheduleSteps,
    };

    console.log('Workflow saved:', workflowData);
    
    if (onSave) {
      onSave(workflowData);
    }
  }, [convertToScheduleSteps, onSave]);

  // Drag start handler for palette items
  const onDragStart = (event: DragEvent, nodeData: any) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Left Sidebar - Node Palette */}
      <div className="w-64 bg-white/80 backdrop-blur-sm border border-white/50 rounded-lg p-4 overflow-y-auto shadow-lg">
        <h3 className="font-semibold text-lg mb-4 text-gray-900">Node Palette</h3>
        <div className="space-y-4">
          {paletteNodes.map((category) => (
            <div key={category.category}>
              <h4 className="text-sm font-medium text-gray-600 mb-2">{category.category}</h4>
              <div className="space-y-2">
                {category.nodes.map((node) => {
                  const colorClasses = node.color === 'blue' 
                    ? 'bg-blue-50 border-blue-200 hover:border-blue-400' 
                    : node.color === 'teal' 
                    ? 'bg-teal-50 border-teal-200 hover:border-teal-400'
                    : 'bg-purple-50 border-purple-200 hover:border-purple-400';
                  
                  const iconColorClasses = node.color === 'blue' 
                    ? 'text-blue-600' 
                    : node.color === 'teal' 
                    ? 'text-teal-600'
                    : 'text-purple-600';
                  
                  const textColorClasses = node.color === 'blue' 
                    ? 'text-blue-900' 
                    : node.color === 'teal' 
                    ? 'text-teal-900'
                    : 'text-purple-900';

                  return (
                    <div
                      key={node.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, node)}
                      className={`p-3 rounded-lg border-2 cursor-move transition-all hover:shadow-md ${colorClasses}`}
                      data-testid={`palette-node-${node.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <node.icon className={`h-4 w-4 ${iconColorClasses}`} />
                        <span className={`text-sm font-medium ${textColorClasses}`}>{node.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={reactFlowWrapper} 
        className="flex-1 bg-white/80 backdrop-blur-sm border border-white/50 rounded-lg overflow-hidden shadow-lg"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background className="bg-gray-50" />
          <Controls className="bg-white/90 backdrop-blur-sm border border-gray-200" />
          <MiniMap 
            className="bg-white/90 backdrop-blur-sm border border-gray-200"
            nodeColor={(node) => {
              if (node.type === 'trigger') return '#3b82f6';
              if (node.type === 'action') return '#14b8a6';
              if (node.type === 'logic') return '#a855f7';
              return '#gray';
            }}
          />
        </ReactFlow>
        
        {/* Save Button */}
        <div className="absolute bottom-4 left-4 z-10">
          <Button
            onClick={handleSave}
            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white shadow-lg"
            data-testid="button-save-workflow"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Workflow
          </Button>
        </div>
      </div>

      {/* Right Sidebar - Configuration Panel */}
      {selectedNode && (
        <div className="w-80 bg-white/80 backdrop-blur-sm border border-white/50 rounded-lg p-4 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-gray-900">Node Configuration</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedNode(null)}
              data-testid="button-close-config"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Node Type</Label>
              <p className="text-sm text-gray-600 mt-1">{selectedNode.data.label}</p>
            </div>

            {/* Action Node Configuration */}
            {selectedNode.type === 'action' && (
              <>
                {selectedNode.data.type === 'wait_delay' ? (
                  <>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Delay Duration</Label>
                      <Input
                        type="number"
                        value={selectedNode.data.config?.delay || 0}
                        onChange={(e) => updateNodeConfig({ delay: parseInt(e.target.value) || 0 })}
                        className="mt-1"
                        data-testid="input-delay-duration"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Delay Unit</Label>
                      <Select
                        value={selectedNode.data.config?.delayUnit || 'hours'}
                        onValueChange={(value) => updateNodeConfig({ delayUnit: value })}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-delay-unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Delay Before Action</Label>
                      <Input
                        type="number"
                        value={selectedNode.data.config?.delay || 0}
                        onChange={(e) => updateNodeConfig({ delay: parseInt(e.target.value) || 0 })}
                        className="mt-1"
                        data-testid="input-action-delay"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Delay Unit</Label>
                      <Select
                        value={selectedNode.data.config?.delayUnit || 'hours'}
                        onValueChange={(value) => updateNodeConfig({ delayUnit: value })}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-action-delay-unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Template</Label>
                      <Select
                        value={selectedNode.data.config?.templateId || ''}
                        onValueChange={(value) => updateNodeConfig({ templateId: value })}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-template">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="template1">Friendly Reminder</SelectItem>
                          <SelectItem value="template2">Formal Notice</SelectItem>
                          <SelectItem value="template3">Final Warning</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Logic Node Configuration */}
            {selectedNode.type === 'logic' && selectedNode.data.type === 'wait_for_response' && (
              <>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Timeout (hours)</Label>
                  <Input
                    type="number"
                    value={selectedNode.data.config?.timeout || 24}
                    onChange={(e) => updateNodeConfig({ timeout: parseInt(e.target.value) || 24 })}
                    className="mt-1"
                    data-testid="input-timeout"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Branch Labels</Label>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm text-gray-600">Response Received</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm text-gray-600">Timeout</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {selectedNode.type === 'logic' && selectedNode.data.type === 'intent_router' && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Intent Types</Label>
                <div className="space-y-2 mt-2">
                  {['payment_plan', 'dispute', 'promise_to_pay', 'general_query', 'unknown'].map((intent) => (
                    <div key={intent} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-sm text-gray-600 capitalize">{intent.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trigger Node Configuration */}
            {selectedNode.type === 'trigger' && selectedNode.data.type === 'balance_threshold' && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Threshold Amount</Label>
                <Input
                  type="number"
                  value={selectedNode.data.config?.threshold || 0}
                  onChange={(e) => updateNodeConfig({ threshold: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                  placeholder="e.g., 1000"
                  data-testid="input-threshold"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
