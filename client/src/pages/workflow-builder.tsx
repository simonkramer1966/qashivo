import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save,
  Play,
  Mail,
  MessageSquare,
  Phone,
  Clock,
  GitBranch,
  Target,
  Zap,
  CheckCircle,
  AlertCircle,
  Settings,
  TestTube,
  Trash2,
  X
} from "lucide-react";

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'decision' | 'delay';
  subType: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, any>;
}

interface WorkflowConnection {
  id: string;
  sourceId: string;
  targetId: string;
  condition?: string;
  label?: string;
}

const NODE_TYPES = {
  trigger: [
    { subType: 'invoice_overdue', label: 'Invoice Overdue', icon: AlertCircle, color: 'bg-red-500' },
    { subType: 'payment_missed', label: 'Payment Missed', icon: Target, color: 'bg-orange-500' },
    { subType: 'promise_broken', label: 'Promise Broken', icon: AlertCircle, color: 'bg-red-600' },
  ],
  action: [
    { subType: 'email', label: 'Send Email', icon: Mail, color: 'bg-blue-500' },
    { subType: 'sms', label: 'Send SMS', icon: MessageSquare, color: 'bg-green-500' },
    { subType: 'whatsapp', label: 'WhatsApp Message', icon: MessageSquare, color: 'bg-green-600' },
    { subType: 'voice_call', label: 'Voice Call', icon: Phone, color: 'bg-purple-500' },
    { subType: 'update_status', label: 'Update Status', icon: CheckCircle, color: 'bg-gray-500' },
  ],
  decision: [
    { subType: 'payment_received', label: 'Payment Received?', icon: CheckCircle, color: 'bg-green-500' },
    { subType: 'email_opened', label: 'Email Opened?', icon: Mail, color: 'bg-blue-500' },
    { subType: 'sms_replied', label: 'SMS Replied?', icon: MessageSquare, color: 'bg-green-500' },
    { subType: 'call_answered', label: 'Call Answered?', icon: Phone, color: 'bg-purple-500' },
  ],
  delay: [
    { subType: 'wait_days', label: 'Wait X Days', icon: Clock, color: 'bg-yellow-500' },
    { subType: 'wait_response', label: 'Wait for Response', icon: Clock, color: 'bg-orange-500' },
  ],
};

export default function WorkflowBuilder() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [connections, setConnections] = useState<WorkflowConnection[]>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [draggedNodeType, setDraggedNodeType] = useState<any>(null);
  const [workflowName, setWorkflowName] = useState("New Workflow");
  const [isTestMode, setIsTestMode] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [tempConnection, setTempConnection] = useState<{ x: number; y: number } | null>(null);
  
  // New state for node dragging
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Keyboard event handler for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode && !e.target || (e.target as HTMLElement).tagName !== 'INPUT') {
          e.preventDefault();
          handleDeleteSelectedNode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode]);

  const handleDragStart = (nodeType: any) => {
    setDraggedNodeType(nodeType);
  };

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNodeType || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: draggedNodeType.type,
      subType: draggedNodeType.subType,
      label: draggedNodeType.label,
      position: { x, y },
      config: {},
    };

    setNodes(prev => [...prev, newNode]);
    setDraggedNodeType(null);
  }, [draggedNodeType]);

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleNodeClick = (node: WorkflowNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting && connectionStart && connectionStart.nodeId !== node.id) {
      // Check if connection already exists
      const connectionExists = connections.some(
        conn => (conn.sourceId === connectionStart.nodeId && conn.targetId === node.id) ||
                (conn.sourceId === node.id && conn.targetId === connectionStart.nodeId)
      );
      
      if (!connectionExists) {
        // Complete the connection
        const newConnection: WorkflowConnection = {
          id: `conn_${Date.now()}`,
          sourceId: connectionStart.nodeId,
          targetId: node.id,
        };
        setConnections(prev => [...prev, newConnection]);
        toast({
          title: "Connection Created",
          description: "Successfully connected the nodes",
        });
      } else {
        toast({
          title: "Connection Exists",
          description: "These nodes are already connected",
          variant: "destructive",
        });
      }
      setIsConnecting(false);
      setConnectionStart(null);
      setTempConnection(null);
    } else if (!isConnecting && !isDraggingNode) {
      setSelectedNode(node);
    }
  };

  const handleConnectionStart = (node: WorkflowNode, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsConnecting(true);
    setConnectionStart({
      nodeId: node.id,
      x: node.position.x,
      y: node.position.y,
    });
    setSelectedNode(null);
    toast({
      title: "Connection Mode",
      description: "Click on another node to connect them, or click empty space to cancel",
    });
  };


  const handleCanvasClick = () => {
    if (isConnecting) {
      setIsConnecting(false);
      setConnectionStart(null);
      setTempConnection(null);
    }
    setSelectedNode(null);
  };

  const removeConnection = (connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
  };

  // Node dragging handlers
  const handleNodeMouseDown = (node: WorkflowNode, e: React.MouseEvent) => {
    if (isConnecting) return; // Don't drag while connecting
    
    e.stopPropagation();
    setIsDraggingNode(true);
    setDraggedNode(node.id);
    setSelectedNode(node);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - node.position.x,
        y: e.clientY - rect.top - node.position.y,
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isConnecting && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setTempConnection({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    } else if (isDraggingNode && draggedNode && canvasRef.current) {
      // Update node position while dragging
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;
      
      setNodes(prev => prev.map(node => 
        node.id === draggedNode 
          ? { ...node, position: { x: newX, y: newY } }
          : node
      ));
      
      // Update selected node position for properties panel
      setSelectedNode(prev => 
        prev && prev.id === draggedNode 
          ? { ...prev, position: { x: newX, y: newY } }
          : prev
      );
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingNode(false);
    setDraggedNode(null);
    setDragOffset({ x: 0, y: 0 });
  };

  // Node deletion handlers
  const deleteNode = (nodeId: string) => {
    // Remove the node
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    
    // Remove all connections to/from this node
    setConnections(prev => prev.filter(conn => 
      conn.sourceId !== nodeId && conn.targetId !== nodeId
    ));
    
    // Clear selection if this node was selected
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const handleDeleteSelectedNode = () => {
    if (selectedNode) {
      const confirmDelete = window.confirm(`Are you sure you want to delete "${selectedNode.label}"?`);
      if (confirmDelete) {
        deleteNode(selectedNode.id);
      }
    }
  };

  const saveWorkflow = async () => {
    if (!workflowName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a workflow name",
        variant: "destructive",
      });
      return;
    }

    try {
      // TODO: Implement API call to save workflow
      toast({
        title: "Success",
        description: "Workflow saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save workflow",
        variant: "destructive",
      });
    }
  };

  const testWorkflow = () => {
    setIsTestMode(!isTestMode);
    if (!isTestMode) {
      toast({
        title: "Test Mode",
        description: "Test mode activated - simulate workflow execution",
      });
    }
  };

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      <main className="flex-1 flex flex-col">
        <Header 
          title="Workflow Builder" 
          subtitle={workflowName}
          action={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={testWorkflow}
                className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                data-testid="button-test-workflow"
              >
                <TestTube className="mr-2 h-4 w-4" />
                {isTestMode ? 'Exit Test' : 'Test'}
              </Button>
              <Button
                onClick={saveWorkflow}
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-save-workflow"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Workflow
              </Button>
            </div>
          }
        />

        <div className="flex-1 flex">
          {/* Left Panel - Toolbox */}
          <div className="w-80 bg-white/80 backdrop-blur-sm border-r border-white/50 shadow-lg p-4 overflow-y-auto">
            <Card className="mb-4 bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Workflow Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="workflow-name" className="text-sm font-medium">
                      Workflow Name
                    </Label>
                    <Input
                      id="workflow-name"
                      value={workflowName}
                      onChange={(e) => setWorkflowName(e.target.value)}
                      className="bg-white/70 border-gray-200/30"
                      data-testid="input-workflow-name"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="triggers" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="triggers">Triggers</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="triggers" className="space-y-4">
                {/* Trigger Nodes */}
                <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center">
                      <Zap className="mr-2 h-4 w-4 text-red-500" />
                      Triggers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {NODE_TYPES.trigger.map((nodeType) => (
                      <div
                        key={nodeType.subType}
                        draggable
                        onDragStart={() => handleDragStart({ type: 'trigger', ...nodeType })}
                        className="flex items-center p-3 bg-white rounded-lg border border-gray-200 cursor-grab hover:shadow-md transition-shadow"
                        data-testid={`trigger-${nodeType.subType}`}
                      >
                        <div className={`p-2 ${nodeType.color} rounded-lg mr-3`}>
                          <nodeType.icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{nodeType.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Decision Nodes */}
                <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center">
                      <GitBranch className="mr-2 h-4 w-4 text-purple-500" />
                      Decisions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {NODE_TYPES.decision.map((nodeType) => (
                      <div
                        key={nodeType.subType}
                        draggable
                        onDragStart={() => handleDragStart({ type: 'decision', ...nodeType })}
                        className="flex items-center p-3 bg-white rounded-lg border border-gray-200 cursor-grab hover:shadow-md transition-shadow"
                        data-testid={`decision-${nodeType.subType}`}
                      >
                        <div className={`p-2 ${nodeType.color} rounded-lg mr-3`}>
                          <nodeType.icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{nodeType.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="actions" className="space-y-4">
                {/* Action Nodes */}
                <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center">
                      <Target className="mr-2 h-4 w-4 text-blue-500" />
                      Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {NODE_TYPES.action.map((nodeType) => (
                      <div
                        key={nodeType.subType}
                        draggable
                        onDragStart={() => handleDragStart({ type: 'action', ...nodeType })}
                        className="flex items-center p-3 bg-white rounded-lg border border-gray-200 cursor-grab hover:shadow-md transition-shadow"
                        data-testid={`action-${nodeType.subType}`}
                      >
                        <div className={`p-2 ${nodeType.color} rounded-lg mr-3`}>
                          <nodeType.icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{nodeType.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Delay Nodes */}
                <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center">
                      <Clock className="mr-2 h-4 w-4 text-yellow-500" />
                      Delays
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {NODE_TYPES.delay.map((nodeType) => (
                      <div
                        key={nodeType.subType}
                        draggable
                        onDragStart={() => handleDragStart({ type: 'delay', ...nodeType })}
                        className="flex items-center p-3 bg-white rounded-lg border border-gray-200 cursor-grab hover:shadow-md transition-shadow"
                        data-testid={`delay-${nodeType.subType}`}
                      >
                        <div className={`p-2 ${nodeType.color} rounded-lg mr-3`}>
                          <nodeType.icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{nodeType.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Center Canvas */}
          <div className="flex-1 relative">
            <div
              ref={canvasRef}
              className="w-full h-full bg-white/30 relative overflow-hidden"
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onClick={handleCanvasClick}
              data-testid="workflow-canvas"
            >
              {/* Grid background */}
              <div className="absolute inset-0 opacity-20">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>

              {/* Connection lines */}
              <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      fill="#17B6C3"
                    />
                  </marker>
                </defs>
                
                {/* Existing connections */}
                {connections.map((connection) => {
                  const sourceNode = nodes.find(n => n.id === connection.sourceId);
                  const targetNode = nodes.find(n => n.id === connection.targetId);
                  
                  if (!sourceNode || !targetNode) return null;
                  
                  const startX = sourceNode.position.x;
                  const startY = sourceNode.position.y;
                  const endX = targetNode.position.x;
                  const endY = targetNode.position.y;
                  
                  // Calculate control points for curved line
                  const dx = endX - startX;
                  const dy = endY - startY;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  const controlOffset = Math.min(distance * 0.3, 100);
                  
                  const cp1x = startX + controlOffset;
                  const cp1y = startY;
                  const cp2x = endX - controlOffset;
                  const cp2y = endY;
                  
                  return (
                    <g key={connection.id}>
                      <path
                        d={`M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`}
                        stroke="#17B6C3"
                        strokeWidth="2"
                        fill="none"
                        markerEnd="url(#arrowhead)"
                        className="hover:stroke-[#1396A1] cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Remove this connection?')) {
                            removeConnection(connection.id);
                          }
                        }}
                        style={{ pointerEvents: 'stroke' }}
                      />
                      {/* Connection label */}
                      {connection.label && (
                        <text
                          x={(startX + endX) / 2}
                          y={(startY + endY) / 2 - 10}
                          textAnchor="middle"
                          fontSize="12"
                          fill="#64748b"
                          className="pointer-events-none"
                        >
                          {connection.label}
                        </text>
                      )}
                    </g>
                  );
                })}
                
                {/* Temporary connection line while dragging */}
                {isConnecting && connectionStart && tempConnection && (
                  <path
                    d={`M ${connectionStart.x} ${connectionStart.y} L ${tempConnection.x} ${tempConnection.y}`}
                    stroke="#17B6C3"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    fill="none"
                    className="opacity-70"
                  />
                )}
              </svg>

              {/* Workflow Nodes */}
              {nodes.map((node) => {
                const nodeTypeConfig = Object.values(NODE_TYPES).flat().find(
                  (type) => type.subType === node.subType
                );
                
                return (
                  <div
                    key={node.id}
                    onClick={(e) => handleNodeClick(node, e)}
                    onMouseDown={(e) => handleNodeMouseDown(node, e)}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 group ${
                      selectedNode?.id === node.id ? 'ring-2 ring-[#17B6C3] ring-offset-2' : ''
                    } ${isDraggingNode && draggedNode === node.id ? 'cursor-grabbing z-50' : 'cursor-grab hover:cursor-grab'}`}
                    style={{
                      left: node.position.x,
                      top: node.position.y,
                    }}
                    data-testid={`node-${node.id}`}
                  >
                    <Card className="bg-white shadow-lg border-2 border-gray-200 hover:shadow-xl transition-all min-w-[160px] relative">
                      {/* Delete button for selected node */}
                      {selectedNode?.id === node.id && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full shadow-lg z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSelectedNode();
                          }}
                          title="Delete node"
                          data-testid={`delete-node-${node.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          {nodeTypeConfig && (
                            <div className={`p-2 ${nodeTypeConfig.color} rounded-lg`}>
                              <nodeTypeConfig.icon className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-sm text-gray-900">{node.label}</div>
                            <div className="text-xs text-gray-500 capitalize">{node.type}</div>
                          </div>
                        </div>
                        
                        {/* Connection ports */}
                        <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 z-20">
                          <div
                            className="w-4 h-4 bg-[#17B6C3] rounded-full border-2 border-white shadow-md cursor-crosshair opacity-60 group-hover:opacity-100 transition-all hover:scale-125 hover:shadow-lg"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleConnectionStart(node, e);
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            title="Click to start connection"
                            data-testid={`connection-port-${node.id}`}
                          />
                        </div>
                        
                        <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 z-20">
                          <div
                            className="w-4 h-4 bg-gray-400 rounded-full border-2 border-white shadow-md opacity-50 group-hover:opacity-80 transition-opacity"
                            title="Connection target"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}

              {/* Empty state */}
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Start Building Your Workflow</p>
                    <p className="text-sm">Drag elements from the left panel onto this canvas</p>
                  </div>
                </div>
              )}
            </div>

            {isTestMode && (
              <div className="absolute top-4 right-4 bg-orange-500/90 text-white px-4 py-2 rounded-lg shadow-lg">
                <div className="flex items-center">
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Mode Active
                </div>
              </div>
            )}

            {isConnecting && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-[#17B6C3]/90 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-ping" />
                  Connection Mode: Click on a node to connect
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Properties */}
          <div className="w-80 bg-white/80 backdrop-blur-sm border-l border-white/50 shadow-lg p-4 overflow-y-auto">
            {selectedNode ? (
              <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center">
                      <Settings className="mr-2 h-5 w-5" />
                      Node Properties
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelectedNode}
                      className="h-8 w-8 p-0"
                      title="Delete node (Del)"
                      data-testid="delete-node-button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Node Label</Label>
                      <Input
                        value={selectedNode.label}
                        onChange={(e) => {
                          setSelectedNode({ ...selectedNode, label: e.target.value });
                          setNodes(prev => prev.map(n => 
                            n.id === selectedNode.id ? { ...n, label: e.target.value } : n
                          ));
                        }}
                        className="bg-white/70 border-gray-200/30"
                        placeholder="Enter node label..."
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Type</Label>
                      <div className="text-sm text-gray-600 capitalize">
                        {selectedNode.type} - {selectedNode.subType.replace('_', ' ')}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Position</Label>
                      <div className="text-sm text-gray-600">
                        X: {Math.round(selectedNode.position.x)}, Y: {Math.round(selectedNode.position.y)}
                      </div>
                    </div>

                    <Separator />

                    {/* Node-specific configuration would go here */}
                    <div className="text-sm text-gray-500 italic">
                      Configuration options for {selectedNode.subType.replace('_', ' ')} will be added here.
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Actions</Label>
                      <div className="text-xs text-gray-500 mb-2">
                        • Drag to move this node
                        • Press Delete key to remove
                        • Click connection port to link nodes
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
                <CardContent className="pt-6">
                  <div className="text-center text-gray-500">
                    <Settings className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select a node to configure its properties</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}