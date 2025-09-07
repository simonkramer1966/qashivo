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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  X,
  ChevronDown,
  Plus,
  Brain,
  Sparkles
} from "lucide-react";

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'decision' | 'delay' | 'ai';
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
  branchType?: 'yes' | 'no' | 'default';
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
    { subType: 'phone', label: 'Make Call', icon: Phone, color: 'bg-purple-500' },
    { subType: 'delay', label: 'Wait/Delay', icon: Clock, color: 'bg-yellow-500' },
  ],
  decision: [
    { subType: 'payment_received', label: 'Payment Received?', icon: CheckCircle, color: 'bg-green-500' },
    { subType: 'email_opened', label: 'Email Opened?', icon: Mail, color: 'bg-blue-500' },
    { subType: 'sms_replied', label: 'SMS Replied?', icon: MessageSquare, color: 'bg-green-500' },
    { subType: 'call_answered', label: 'Call Answered?', icon: Phone, color: 'bg-purple-500' },
    { subType: 'response_positive', label: 'Positive Response?', icon: CheckCircle, color: 'bg-green-600' },
    { subType: 'commitment_made', label: 'Payment Commitment?', icon: Target, color: 'bg-emerald-500' },
    { subType: 'dispute_raised', label: 'Dispute Raised?', icon: AlertCircle, color: 'bg-red-500' },
    { subType: 'contact_successful', label: 'Contact Successful?', icon: CheckCircle, color: 'bg-blue-600' },
  ],
  ai: [
    { subType: 'generate_email', label: 'AI Generate Email', icon: Brain, color: 'bg-indigo-500' },
    { subType: 'analyze_response', label: 'AI Analyze Response', icon: Sparkles, color: 'bg-violet-500' },
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

  const updateNodeConfig = (config: Record<string, any>) => {
    if (!selectedNode) return;
    
    const updatedNode = { ...selectedNode, config: { ...selectedNode.config, ...config } };
    setSelectedNode(updatedNode);
    setNodes(prev => prev.map(node => 
      node.id === selectedNode.id ? updatedNode : node
    ));
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
                  {/* Default arrowhead */}
                  <marker
                    id="arrowhead-default"
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
                  {/* Yes arrowhead (green) */}
                  <marker
                    id="arrowhead-yes"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      fill="#10B981"
                    />
                  </marker>
                  {/* No arrowhead (red) */}
                  <marker
                    id="arrowhead-no"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      fill="#EF4444"
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
                  
                  // Get connection color based on branch type
                  const getConnectionColor = () => {
                    switch (connection.branchType) {
                      case 'yes': return '#10B981'; // Green
                      case 'no': return '#EF4444';  // Red
                      default: return '#17B6C3';    // Blue (default)
                    }
                  };
                  
                  const strokeColor = getConnectionColor();
                  
                  // Get branch label
                  const getBranchLabel = () => {
                    if (connection.branchType === 'yes') return 'YES';
                    if (connection.branchType === 'no') return 'NO';
                    return connection.label || '';
                  };
                  
                  return (
                    <g key={connection.id}>
                      <path
                        d={`M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`}
                        stroke={strokeColor}
                        strokeWidth="2"
                        fill="none"
                        markerEnd={`url(#arrowhead-${connection.branchType || 'default'})`}
                        className="cursor-pointer transition-all hover:stroke-opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Remove this connection?')) {
                            removeConnection(connection.id);
                          }
                        }}
                        style={{ pointerEvents: 'stroke' }}
                      />
                      
                      {/* Branch label with colored background */}
                      {getBranchLabel() && (
                        <g>
                          <rect
                            x={(startX + endX) / 2 - 15}
                            y={(startY + endY) / 2 - 18}
                            width="30"
                            height="16"
                            rx="8"
                            fill={strokeColor}
                            className="pointer-events-none"
                          />
                          <text
                            x={(startX + endX) / 2}
                            y={(startY + endY) / 2 - 8}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="bold"
                            fill="white"
                            className="pointer-events-none"
                          >
                            {getBranchLabel()}
                          </text>
                        </g>
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

                    {/* Node-specific configuration */}
                    {selectedNode.type === 'trigger' && selectedNode.subType === 'invoice_overdue' && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium bg-gray-50 rounded-lg hover:bg-gray-100">
                          <span>Invoice Overdue Configuration</span>
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <div>
                            <Label className="text-sm font-medium">Days Overdue Threshold</Label>
                            <Input
                              type="number"
                              min="1"
                              max="365"
                              value={selectedNode.config.daysOverdueThreshold || 30}
                              onChange={(e) => updateNodeConfig({ daysOverdueThreshold: parseInt(e.target.value) })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="30"
                            />
                            <p className="text-xs text-gray-500 mt-1">Trigger when invoice is overdue by this many days</p>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium">Minimum Amount ($)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={selectedNode.config.minimumAmount || 0}
                              onChange={(e) => updateNodeConfig({ minimumAmount: parseFloat(e.target.value) })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="0.00"
                            />
                            <p className="text-xs text-gray-500 mt-1">Only trigger for invoices above this amount</p>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Customer Type Filter</Label>
                            <Select 
                              value={selectedNode.config.customerTypeFilter || 'both'} 
                              onValueChange={(value) => updateNodeConfig({ customerTypeFilter: value })}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Select customer type" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200">
                                <SelectItem value="individual">Individual</SelectItem>
                                <SelectItem value="business">Business</SelectItem>
                                <SelectItem value="both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Previous Contact Limit</Label>
                            <Input
                              type="number"
                              min="0"
                              value={selectedNode.config.previousContactLimit || 0}
                              onChange={(e) => updateNodeConfig({ previousContactLimit: parseInt(e.target.value) })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="0"
                            />
                            <p className="text-xs text-gray-500 mt-1">Max previous contact attempts before triggering</p>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Time Window</Label>
                            <Select 
                              value={selectedNode.config.timeWindow || 'business_hours'} 
                              onValueChange={(value) => updateNodeConfig({ timeWindow: value })}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Select time window" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200">
                                <SelectItem value="business_hours">Business Hours Only</SelectItem>
                                <SelectItem value="twenty_four_seven">24/7</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {selectedNode.type === 'action' && selectedNode.subType === 'email' && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium bg-gray-50 rounded-lg hover:bg-gray-100">
                          <span>Send Email Configuration</span>
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <div>
                            <Label className="text-sm font-medium">Email Template</Label>
                            <Select 
                              value={selectedNode.config.templateId || ''} 
                              onValueChange={(value) => updateNodeConfig({ templateId: value })}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Select email template" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200">
                                <SelectItem value="first_notice">First Notice</SelectItem>
                                <SelectItem value="second_notice">Second Notice</SelectItem>
                                <SelectItem value="final_demand">Final Demand</SelectItem>
                                <SelectItem value="payment_plan">Payment Plan Offer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Send Delay</Label>
                            <Select 
                              value={selectedNode.config.sendDelay || 'immediate'} 
                              onValueChange={(value) => updateNodeConfig({ sendDelay: value })}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Select send timing" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200">
                                <SelectItem value="immediate">Send Immediately</SelectItem>
                                <SelectItem value="scheduled">Schedule for Later</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedNode.config.sendDelay === 'scheduled' && (
                            <div>
                              <Label className="text-sm font-medium">Scheduled Time</Label>
                              <Input
                                type="time"
                                value={selectedNode.config.scheduledTime || '09:00'}
                                onChange={(e) => updateNodeConfig({ scheduledTime: e.target.value })}
                                className="bg-white/70 border-gray-200/30"
                              />
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Tracking Options</Label>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="track-opens"
                                checked={selectedNode.config.trackOpens || false}
                                onCheckedChange={(checked) => updateNodeConfig({ trackOpens: checked })}
                              />
                              <Label htmlFor="track-opens" className="text-sm">Track email opens</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="track-clicks"
                                checked={selectedNode.config.trackClicks || false}
                                onCheckedChange={(checked) => updateNodeConfig({ trackClicks: checked })}
                              />
                              <Label htmlFor="track-clicks" className="text-sm">Track link clicks</Label>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Escalation (days)</Label>
                            <Input
                              type="number"
                              min="1"
                              value={selectedNode.config.escalationDays || 7}
                              onChange={(e) => updateNodeConfig({ escalationDays: parseInt(e.target.value) })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="7"
                            />
                            <p className="text-xs text-gray-500 mt-1">Escalate if no response after this many days</p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {selectedNode.type === 'action' && selectedNode.subType === 'sms' && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium bg-gray-50 rounded-lg hover:bg-gray-100">
                          <span>Send SMS Configuration</span>
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <div>
                            <Label className="text-sm font-medium">Message Template</Label>
                            <Textarea
                              value={selectedNode.config.messageTemplate || ''}
                              onChange={(e) => updateNodeConfig({ messageTemplate: e.target.value })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="Hi [Name], your invoice [InvoiceNumber] for $[Amount] is overdue. Please pay at [PaymentLink]"
                              rows={3}
                            />
                            <p className="text-xs text-gray-500 mt-1">Max 160 characters for SMS</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Send Time Start</Label>
                              <Input
                                type="time"
                                value={selectedNode.config.sendTimeStart || '09:00'}
                                onChange={(e) => updateNodeConfig({ sendTimeStart: e.target.value })}
                                className="bg-white/70 border-gray-200/30"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Send Time End</Label>
                              <Input
                                type="time"
                                value={selectedNode.config.sendTimeEnd || '20:00'}
                                onChange={(e) => updateNodeConfig({ sendTimeEnd: e.target.value })}
                                className="bg-white/70 border-gray-200/30"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="opt-out-compliance"
                                checked={selectedNode.config.optOutCompliance || true}
                                onCheckedChange={(checked) => updateNodeConfig({ optOutCompliance: checked })}
                              />
                              <Label htmlFor="opt-out-compliance" className="text-sm">Include opt-out instructions</Label>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Response Handling</Label>
                            <Select 
                              value={selectedNode.config.responseHandling || 'automated'} 
                              onValueChange={(value) => updateNodeConfig({ responseHandling: value })}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Select response handling" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200">
                                <SelectItem value="automated">Automated Response</SelectItem>
                                <SelectItem value="manual">Manual Review</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {selectedNode.type === 'action' && selectedNode.subType === 'phone' && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium bg-gray-50 rounded-lg hover:bg-gray-100">
                          <span>Make Call Configuration</span>
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <div>
                            <Label className="text-sm font-medium">Call Script</Label>
                            <Select 
                              value={selectedNode.config.scriptId || ''} 
                              onValueChange={(value) => updateNodeConfig({ scriptId: value })}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Select call script" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200">
                                <SelectItem value="friendly_reminder">Friendly Reminder</SelectItem>
                                <SelectItem value="formal_notice">Formal Notice</SelectItem>
                                <SelectItem value="payment_plan">Payment Plan Discussion</SelectItem>
                                <SelectItem value="final_demand">Final Demand</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Max Retry Attempts</Label>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              value={selectedNode.config.maxRetryAttempts || 3}
                              onChange={(e) => updateNodeConfig({ maxRetryAttempts: parseInt(e.target.value) })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="3"
                            />
                            <p className="text-xs text-gray-500 mt-1">Number of call attempts before giving up</p>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Voicemail Message</Label>
                            <Textarea
                              value={selectedNode.config.voicemailMessage || ''}
                              onChange={(e) => updateNodeConfig({ voicemailMessage: e.target.value })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="Hi [Name], this is [Company] regarding invoice [InvoiceNumber]. Please call us back at [PhoneNumber]."
                              rows={3}
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="outcome-tracking"
                              checked={selectedNode.config.outcomeTracking || true}
                              onCheckedChange={(checked) => updateNodeConfig({ outcomeTracking: checked })}
                            />
                            <Label htmlFor="outcome-tracking" className="text-sm">Track call outcomes and responses</Label>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {selectedNode.type === 'action' && selectedNode.subType === 'delay' && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium bg-gray-50 rounded-lg hover:bg-gray-100">
                          <span>Wait/Delay Configuration</span>
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Duration</Label>
                              <Input
                                type="number"
                                min="1"
                                value={selectedNode.config.duration || 1}
                                onChange={(e) => updateNodeConfig({ duration: parseInt(e.target.value) })}
                                className="bg-white/70 border-gray-200/30"
                                placeholder="1"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Unit</Label>
                              <Select 
                                value={selectedNode.config.durationUnit || 'days'} 
                                onValueChange={(value) => updateNodeConfig({ durationUnit: value })}
                              >
                                <SelectTrigger className="bg-white border-gray-200">
                                  <SelectValue placeholder="Select unit" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-gray-200">
                                  <SelectItem value="hours">Hours</SelectItem>
                                  <SelectItem value="days">Days</SelectItem>
                                  <SelectItem value="weeks">Weeks</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="business-days-only"
                                checked={selectedNode.config.businessDaysOnly || false}
                                onCheckedChange={(checked) => updateNodeConfig({ businessDaysOnly: checked })}
                              />
                              <Label htmlFor="business-days-only" className="text-sm">Business days only</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="skip-on-payment"
                                checked={selectedNode.config.skipOnPayment || true}
                                onCheckedChange={(checked) => updateNodeConfig({ skipOnPayment: checked })}
                              />
                              <Label htmlFor="skip-on-payment" className="text-sm">Skip delay if payment received</Label>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {selectedNode.type === 'ai' && selectedNode.subType === 'generate_email' && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium bg-gray-50 rounded-lg hover:bg-gray-100">
                          <span>AI Email Generation Configuration</span>
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <div>
                            <Label className="text-sm font-medium">Tone</Label>
                            <Select 
                              value={selectedNode.config.tone || 'professional'} 
                              onValueChange={(value) => updateNodeConfig({ tone: value })}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Select tone" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200">
                                <SelectItem value="friendly">Friendly</SelectItem>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="firm">Firm</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Personalization Level</Label>
                            <Select 
                              value={selectedNode.config.personalizationLevel || 'basic'} 
                              onValueChange={(value) => updateNodeConfig({ personalizationLevel: value })}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Select personalization" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200">
                                <SelectItem value="basic">Basic (Name, Amount)</SelectItem>
                                <SelectItem value="advanced">Advanced (History, Context)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Template Base</Label>
                            <Input
                              value={selectedNode.config.templateBase || ''}
                              onChange={(e) => updateNodeConfig({ templateBase: e.target.value })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="Base template or guidelines for AI"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="customer-history"
                                checked={selectedNode.config.customerHistoryAnalysis || true}
                                onCheckedChange={(checked) => updateNodeConfig({ customerHistoryAnalysis: checked })}
                              />
                              <Label htmlFor="customer-history" className="text-sm">Analyze customer history</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="legal-compliance"
                                checked={selectedNode.config.legalComplianceCheck || true}
                                onCheckedChange={(checked) => updateNodeConfig({ legalComplianceCheck: checked })}
                              />
                              <Label htmlFor="legal-compliance" className="text-sm">Legal compliance check</Label>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {selectedNode.type === 'ai' && selectedNode.subType === 'analyze_response' && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium bg-gray-50 rounded-lg hover:bg-gray-100">
                          <span>AI Response Analysis Configuration</span>
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <div>
                            <Label className="text-sm font-medium">Max Urgency Score</Label>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              value={selectedNode.config.maxUrgencyScore || 10}
                              onChange={(e) => updateNodeConfig({ maxUrgencyScore: parseInt(e.target.value) })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="10"
                            />
                            <p className="text-xs text-gray-500 mt-1">Scale for urgency scoring (1-10)</p>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Analysis Features</Label>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="sentiment-analysis"
                                checked={selectedNode.config.sentimentAnalysis || true}
                                onCheckedChange={(checked) => updateNodeConfig({ sentimentAnalysis: checked })}
                              />
                              <Label htmlFor="sentiment-analysis" className="text-sm">Sentiment analysis</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="intent-detection"
                                checked={selectedNode.config.intentDetection || true}
                                onCheckedChange={(checked) => updateNodeConfig({ intentDetection: checked })}
                              />
                              <Label htmlFor="intent-detection" className="text-sm">Intent detection</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="urgency-scoring"
                                checked={selectedNode.config.urgencyScoring || true}
                                onCheckedChange={(checked) => updateNodeConfig({ urgencyScoring: checked })}
                              />
                              <Label htmlFor="urgency-scoring" className="text-sm">Urgency scoring</Label>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Recommended Actions</Label>
                            <Textarea
                              value={selectedNode.config.recommendedActions?.join('\n') || ''}
                              onChange={(e) => updateNodeConfig({ recommendedActions: e.target.value.split('\n').filter(action => action.trim()) })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="Follow up in 3 days&#10;Escalate to manager&#10;Offer payment plan"
                              rows={3}
                            />
                            <p className="text-xs text-gray-500 mt-1">One action per line</p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {selectedNode.type === 'decision' && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium bg-gray-50 rounded-lg hover:bg-gray-100">
                          <span>Decision Node Configuration</span>
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <div>
                            <Label className="text-sm font-medium">Primary Condition</Label>
                            <Textarea
                              value={selectedNode.config.condition || ''}
                              onChange={(e) => updateNodeConfig({ condition: e.target.value })}
                              className="bg-white/70 border-gray-200/30"
                              placeholder="e.g., Payment received in last 7 days?"
                              rows={2}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium text-green-600">YES Action</Label>
                              <Input
                                value={selectedNode.config.yesAction || ''}
                                onChange={(e) => updateNodeConfig({ yesAction: e.target.value })}
                                className="bg-white/70 border-gray-200/30"
                                placeholder="Continue to thank you"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-red-600">NO Action</Label>
                              <Input
                                value={selectedNode.config.noAction || ''}
                                onChange={(e) => updateNodeConfig({ noAction: e.target.value })}
                                className="bg-white/70 border-gray-200/30"
                                placeholder="Escalate collection"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">What-If Scenarios</Label>
                            <div className="space-y-2">
                              {(selectedNode.config.whatIfScenarios || []).map((scenario: any, index: number) => (
                                <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                                  <Input
                                    value={scenario.label || ''}
                                    onChange={(e) => {
                                      const scenarios = [...(selectedNode.config.whatIfScenarios || [])];
                                      scenarios[index] = { ...scenarios[index], label: e.target.value };
                                      updateNodeConfig({ whatIfScenarios: scenarios });
                                    }}
                                    className="flex-1 bg-white border-gray-200"
                                    placeholder="Scenario description"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const scenarios = [...(selectedNode.config.whatIfScenarios || [])];
                                      scenarios.splice(index, 1);
                                      updateNodeConfig({ whatIfScenarios: scenarios });
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const scenarios = [...(selectedNode.config.whatIfScenarios || [])];
                                  scenarios.push({ id: `scenario_${Date.now()}`, label: '', condition: '' });
                                  updateNodeConfig({ whatIfScenarios: scenarios });
                                }}
                                className="w-full"
                              >
                                <Plus className="h-3 w-3 mr-2" />
                                Add What-If Scenario
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    
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