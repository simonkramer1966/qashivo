import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType,
  NodeTypes,
  EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Plus, MessageSquare, Brain, Phone, CreditCard, CheckCircle,
  Calendar, PhoneOff, Settings, Save, Play, Pause, 
  RotateCcw, Download, Upload, Trash2, Edit, Copy
} from 'lucide-react';

import { apiRequest, queryClient } from '@/lib/queryClient';

// Voice State Types
const VOICE_STATE_TYPES = {
  greeting: {
    label: 'Greeting',
    icon: MessageSquare,
    color: '#17B6C3',
    description: 'Welcome and introduce the call purpose'
  },
  information_gathering: {
    label: 'Information Gathering',
    icon: Brain,
    color: '#3B82F6',
    description: 'Ask questions and collect customer information'
  },
  decision_point: {
    label: 'Decision Point', 
    icon: Settings,
    color: '#F59E0B',
    description: 'Branch conversation based on customer responses'
  },
  payment_options: {
    label: 'Payment Options',
    icon: CreditCard,
    color: '#10B981',
    description: 'Present payment methods and options'
  },
  confirmation: {
    label: 'Confirmation',
    icon: CheckCircle,
    color: '#8B5CF6',
    description: 'Confirm agreements and next steps'
  },
  schedule_followup: {
    label: 'Schedule Follow-up',
    icon: Calendar,
    color: '#EF4444',
    description: 'Schedule future contact or appointments'
  },
  call_ending: {
    label: 'Call Ending',
    icon: PhoneOff,
    color: '#6B7280',
    description: 'Professional call conclusion'
  }
};

// Form schemas
const voiceStateSchema = z.object({
  name: z.string().min(1, 'State name is required'),
  type: z.enum(['greeting', 'information_gathering', 'decision_point', 'payment_options', 'confirmation', 'schedule_followup', 'call_ending']),
  description: z.string().optional(),
  config: z.object({}).optional(),
});

const voiceTransitionSchema = z.object({
  name: z.string().min(1, 'Transition name is required'),
  condition: z.string().min(1, 'Condition is required'),
  fromStateId: z.string().min(1, 'From state is required'),
  toStateId: z.string().min(1, 'To state is required'),
});

type VoiceStateForm = z.infer<typeof voiceStateSchema>;
type VoiceTransitionForm = z.infer<typeof voiceTransitionSchema>;

// Custom Node Component
function VoiceStateNode({ data, selected }: { data: any; selected: boolean }) {
  const stateType = VOICE_STATE_TYPES[data.type as keyof typeof VOICE_STATE_TYPES];
  const Icon = stateType?.icon || MessageSquare;

  return (
    <div className={`px-4 py-3 shadow-lg rounded-lg bg-white border-2 min-w-[200px] ${
      selected ? 'border-[#17B6C3]' : 'border-gray-200'
    }`}>
      <div className="flex items-center space-x-3">
        <div 
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${stateType?.color || '#17B6C3'}10` }}
        >
          <Icon 
            className="h-5 w-5" 
            style={{ color: stateType?.color || '#17B6C3' }}
          />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{data.name}</div>
          <div className="text-sm text-gray-600">{stateType?.label}</div>
        </div>
      </div>
      
      <div className="mt-2">
        <Badge variant="outline" style={{ borderColor: stateType?.color, color: stateType?.color }}>
          {stateType?.label}
        </Badge>
      </div>
      
      {data.description && (
        <div className="mt-2 text-xs text-gray-500">
          {data.description}
        </div>
      )}
    </div>
  );
}

// Node types configuration
const nodeTypes: NodeTypes = {
  voiceState: VoiceStateNode,
};

interface VoiceWorkflowBuilderProps {
  workflowId: string;
}

export default function VoiceWorkflowBuilder({ workflowId }: VoiceWorkflowBuilderProps) {
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isStateDialogOpen, setIsStateDialogOpen] = useState(false);
  const [isTransitionDialogOpen, setIsTransitionDialogOpen] = useState(false);

  // Fetch workflow data
  const { data: workflow, isLoading } = useQuery({
    queryKey: ['/api/voice/workflows', workflowId],
    enabled: !!workflowId,
  });

  // Form instances
  const stateForm = useForm<VoiceStateForm>({
    resolver: zodResolver(voiceStateSchema),
    defaultValues: {
      name: '',
      type: 'greeting',
      description: '',
      config: {},
    },
  });

  const transitionForm = useForm<VoiceTransitionForm>({
    resolver: zodResolver(voiceTransitionSchema),
    defaultValues: {
      name: '',
      condition: '',
      fromStateId: '',
      toStateId: '',
    },
  });

  // Create voice state mutation
  const createStateMutation = useMutation({
    mutationFn: async (data: VoiceStateForm) => {
      // Map frontend form data to backend schema format
      const mappedData = {
        stateType: data.type, // Map 'type' to 'stateType'
        label: data.name, // Map 'name' to 'label'
        position: { x: Math.random() * 400, y: Math.random() * 300 }, // Required position field
        config: data.config || {}, // Ensure config is never undefined
        prompt: data.description || '', // Use description as prompt
        expectedResponses: [], // Default empty array
        isStartState: false, // Default value
        isEndState: false, // Default value
      };

      const response = await fetch(`/api/voice/workflows/${workflowId}/states`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappedData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create state');
      }
      return response.json();
    },
    onSuccess: (newState: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/workflows', workflowId] });
      
      // Add node to canvas
      const stateType = VOICE_STATE_TYPES[newState.stateType as keyof typeof VOICE_STATE_TYPES];
      const newNode: Node = {
        id: newState.id,
        type: 'voiceState',
        position: newState.position || { x: Math.random() * 400, y: Math.random() * 300 },
        data: {
          ...newState,
          label: newState.label, // Backend now returns 'label' not 'name'
          stateType: newState.stateType, // Backend returns 'stateType' not 'type'
        },
      };
      setNodes((nds) => [...nds, newNode]);
      
      setIsStateDialogOpen(false);
      stateForm.reset();
      toast({
        title: 'Success',
        description: 'Voice state created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create voice state',
        variant: 'destructive',
      });
    },
  });

  // Create transition mutation
  const createTransitionMutation = useMutation({
    mutationFn: async (data: VoiceTransitionForm) => {
      const response = await fetch(`/api/voice/workflows/${workflowId}/transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create transition');
      return response.json();
    },
    onSuccess: (newTransition: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/workflows', workflowId] });
      
      // Add edge to canvas
      const newEdge: Edge = {
        id: newTransition.id,
        source: newTransition.fromStateId,
        target: newTransition.toStateId,
        label: newTransition.name,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };
      setEdges((eds) => [...eds, newEdge]);
      
      setIsTransitionDialogOpen(false);
      transitionForm.reset();
      toast({
        title: 'Success',
        description: 'Voice transition created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create voice transition',
        variant: 'destructive',
      });
    },
  });

  // Initialize workflow data
  useMemo(() => {
    if (workflow) {
      // Convert states to nodes
      const workflowNodes = (workflow as any).states?.map((state: any) => ({
        id: state.id,
        type: 'voiceState',
        position: state.position || { x: Math.random() * 400, y: Math.random() * 300 },
        data: {
          ...state,
          label: state.name,
        },
      })) || [];

      // Convert transitions to edges
      const workflowEdges = (workflow as any).transitions?.map((transition: any) => ({
        id: transition.id,
        source: transition.fromStateId,
        target: transition.toStateId,
        label: transition.name,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      })) || [];

      setNodes(workflowNodes);
      setEdges(workflowEdges);
    }
  }, [workflow, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-gray-500">Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow Builder Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold">Workflow: {(workflow as any)?.name}</h4>
          <p className="text-sm text-gray-600">Drag and drop to build your conversational AI flow</p>
        </div>
        <div className="flex items-center space-x-3">
          <Dialog open={isStateDialogOpen} onOpenChange={setIsStateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-add-state">
                <Plus className="mr-2 h-4 w-4" />
                Add State
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-white border border-gray-200">
              <DialogHeader>
                <DialogTitle>Add Voice State</DialogTitle>
              </DialogHeader>
              <Form {...stateForm}>
                <form onSubmit={stateForm.handleSubmit((data) => createStateMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={stateForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Welcome Customer" {...field} data-testid="input-state-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={stateForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-state-type">
                              <SelectValue placeholder="Select state type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white border-gray-200">
                            {Object.entries(VOICE_STATE_TYPES).map(([key, type]) => {
                              const Icon = type.icon;
                              return (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center space-x-2">
                                    <Icon className="h-4 w-4" style={{ color: type.color }} />
                                    <span>{type.label}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={stateForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe what happens in this state..." {...field} data-testid="textarea-state-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsStateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createStateMutation.isPending} data-testid="button-save-state">
                      {createStateMutation.isPending ? 'Creating...' : 'Add State'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isTransitionDialogOpen} onOpenChange={setIsTransitionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-transition">
                <Plus className="mr-2 h-4 w-4" />
                Add Transition
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-white border border-gray-200">
              <DialogHeader>
                <DialogTitle>Add Voice Transition</DialogTitle>
              </DialogHeader>
              <Form {...transitionForm}>
                <form onSubmit={transitionForm.handleSubmit((data) => createTransitionMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={transitionForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transition Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Customer Agrees to Pay" {...field} data-testid="input-transition-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={transitionForm.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe when this transition should trigger..." {...field} data-testid="textarea-transition-condition" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={transitionForm.control}
                      name="fromStateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From State</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-from-state">
                                <SelectValue placeholder="Select from state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white border-gray-200">
                              {nodes.map((node) => (
                                <SelectItem key={node.id} value={node.id}>
                                  {node.data.name as string}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={transitionForm.control}
                      name="toStateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>To State</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-to-state">
                                <SelectValue placeholder="Select to state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white border-gray-200">
                              {nodes.map((node) => (
                                <SelectItem key={node.id} value={node.id}>
                                  {node.data.name as string}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsTransitionDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createTransitionMutation.isPending} data-testid="button-save-transition">
                      {createTransitionMutation.isPending ? 'Creating...' : 'Add Transition'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" data-testid="button-save-workflow">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          
          <Button variant="outline" size="sm" data-testid="button-test-workflow">
            <Play className="h-4 w-4 mr-2" />
            Test
          </Button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div style={{ width: '100%', height: '600px' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
            >
              <Controls />
              <MiniMap />
              <Background gap={12} size={1} />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      {/* State Types Palette */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Voice State Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(VOICE_STATE_TYPES).map(([key, type]) => {
              const Icon = type.icon;
              return (
                <div 
                  key={key} 
                  className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:border-gray-300 cursor-pointer transition-colors"
                  onClick={() => {
                    stateForm.setValue('type', key as any);
                    setIsStateDialogOpen(true);
                  }}
                  data-testid={`state-type-${key}`}
                >
                  <div 
                    className="p-2 rounded-lg mb-2"
                    style={{ backgroundColor: `${type.color}10` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: type.color }} />
                  </div>
                  <span className="text-xs font-medium text-center">{type.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Node Details */}
      {selectedNode && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">State Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">{selectedNode.data.name as string}</h4>
                <p className="text-sm text-gray-600">{selectedNode.data.description as string}</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {VOICE_STATE_TYPES[selectedNode.data.type as keyof typeof VOICE_STATE_TYPES]?.label}
                </Badge>
              </div>
              
              <div className="flex space-x-3">
                <Button size="sm" variant="outline" data-testid={`button-edit-state-${selectedNode.id}`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Configuration
                </Button>
                <Button size="sm" variant="outline" data-testid={`button-copy-state-${selectedNode.id}`}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>
                <Button size="sm" variant="outline" data-testid={`button-delete-state-${selectedNode.id}`}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}