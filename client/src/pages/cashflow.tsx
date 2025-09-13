import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Advanced Feature Imports
import { useKeyboardShortcuts, getCommonShortcuts, getTabNavigationShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsModal from "@/components/ui/keyboard-shortcuts-modal";
import UserPreferencesPanel from "@/components/ui/user-preferences-panel";
// Lazy loaded chart components for better performance
const ScenarioComparisonChart = lazy(() => import("@/components/cashflow/ScenarioComparisonChart"));
const TimelineVisualization = lazy(() => import("@/components/cashflow/TimelineVisualization"));
const WaterfallChart = lazy(() => import("@/components/cashflow/WaterfallChart"));
const HeatmapVisualization = lazy(() => import("@/components/cashflow/HeatmapVisualization"));
const AILearningInsightsDashboard = lazy(() => import("@/components/collections/AILearningInsightsDashboard"));
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  Target,
  Activity,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Shield,
  Settings,
  RefreshCw,
  Lightbulb,
  TrendingDown as TrendingDownIcon,
  Save,
  Download,
  Upload,
  Copy,
  Trash2,
  Edit3,
  Users,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronDown,
  X,
  Menu,
  Star,
  Bookmark,
  Share2,
  Filter,
  Search,
  Plus
} from "lucide-react";

// Scenario interface for saved scenarios
interface SavedScenario {
  id: string;
  name: string;
  description: string;
  inputs: {
    collectionRate: number[];
    paymentDelays: number[];
    newInvoices: number[];
    expenseChanges: number[];
  };
  impact: {
    netImpact: number;
    projectedInflow: number;
    projectedOutflow: number;
    newRunway: number;
  };
  createdAt: string;
}

// Collection strategy interface
interface CollectionStrategy {
  id: string;
  name: string;
  effectiveness: number;
  avgCollectionTime: number;
  cost: number;
  roi: number;
}

// Risk factor interface
interface RiskFactor {
  id: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  impact: number;
  mitigationActions: string[];
}

export default function Cashflow() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // State management for Command Center
  const [activeTab, setActiveTab] = useState<string>("scenario");
  const [criticalActions] = useState(3);
  const [isActionSidebarOpen, setIsActionSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [scenarioInputs, setScenarioInputs] = useState({
    collectionRate: [75], // percentage
    paymentDelays: [15], // days
    newInvoices: [25000], // dollar amount
    expenseChanges: [0] // percentage change
  });
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [stressTestResults, setStressTestResults] = useState<any>(null);
  const [expandedRiskCategory, setExpandedRiskCategory] = useState<string | null>(null);

  // Advanced Features State
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showUserPreferences, setShowUserPreferences] = useState(false);
  const [userPreferences, setUserPreferences] = useState({
    theme: 'system' as 'light' | 'dark' | 'system',
    accentColor: '#17B6C3',
    reducedMotion: false,
    compactMode: false,
    dashboardLayout: [],
    defaultTab: 'scenario',
    sidebarCollapsed: false,
    cashRunwayWarning: 6,
    overduePaymentAlert: 30,
    collectionTargetThreshold: 85,
    automationAlerts: true,
    defaultExportFormat: 'xlsx' as 'xlsx' | 'csv' | 'pdf',
    defaultCurrency: 'USD',
    defaultDateRange: '6m' as '1m' | '3m' | '6m' | '1y',
    includeCharts: true,
    autoSaveScenarios: true,
    showTooltips: true,
    enableKeyboardShortcuts: true,
    animationsEnabled: true,
    quickActions: [
      { id: '1', label: 'Export Report', action: 'export', icon: 'Download', enabled: true },
      { id: '2', label: 'New Scenario', action: 'new-scenario', icon: 'Plus', enabled: true },
      { id: '3', label: 'Sync Data', action: 'sync', icon: 'RefreshCw', enabled: true },
      { id: '4', label: 'View Analytics', action: 'analytics', icon: 'BarChart3', enabled: false }
    ]
  });
  const [advancedViewMode, setAdvancedViewMode] = useState<'standard' | 'advanced'>('standard');

  // Load preferences from localStorage on component mount
  useEffect(() => {
    const savedPreferences = localStorage.getItem('cashflow-preferences');
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences);
        setUserPreferences(prev => ({ ...prev, ...parsed }));
        setAdvancedViewMode(parsed.advancedViewMode || 'standard');
        
        // Apply theme immediately
        if (parsed.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (parsed.theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          // System theme
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.classList.toggle('dark', isDark);
        }
      } catch (error) {
        console.warn('Failed to parse saved preferences:', error);
      }
    }
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    const prefsToSave = { ...userPreferences, advancedViewMode };
    localStorage.setItem('cashflow-preferences', JSON.stringify(prefsToSave));
  }, [userPreferences, advancedViewMode]);

  // Handle theme changes
  const handleThemeChange = useCallback((newTheme: 'light' | 'dark' | 'system') => {
    setUserPreferences(prev => ({ ...prev, theme: newTheme }));
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System theme
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, []);

  // Handle advanced view mode toggle
  const toggleAdvancedMode = useCallback(() => {
    setAdvancedViewMode(prev => prev === 'standard' ? 'advanced' : 'standard');
  }, []);


  // Mock data for realistic scenarios
  const currentCashData = {
    totalAvailable: 246230,
    operatingAccount: 156780,
    reserveAccount: 89450,
    netCashflow: 48327,
    cashRunway: 18.5,
    criticalPayments: 65100,
    status: "healthy" // healthy, warning, critical
  };

  // Mock data for advanced visualizations
  const mockScenarioData = useMemo(() => [
    {
      id: '1',
      name: 'Conservative',
      color: '#059669',
      style: 'line' as const,
      data: [
        { month: 'Jan 2025', cashflow: 45000, runway: 18.5, inflow: 125000, outflow: 80000 },
        { month: 'Feb 2025', cashflow: 48000, runway: 19.2, inflow: 130000, outflow: 82000 },
        { month: 'Mar 2025', cashflow: 52000, runway: 20.1, inflow: 135000, outflow: 83000 },
        { month: 'Apr 2025', cashflow: 46000, runway: 19.5, inflow: 128000, outflow: 82000 },
        { month: 'May 2025', cashflow: 49000, runway: 19.8, inflow: 132000, outflow: 83000 },
        { month: 'Jun 2025', cashflow: 53000, runway: 20.5, inflow: 138000, outflow: 85000 }
      ]
    },
    {
      id: '2',
      name: 'Aggressive',
      color: '#DC2626',
      style: 'line' as const,
      data: [
        { month: 'Jan 2025', cashflow: 58000, runway: 22.1, inflow: 145000, outflow: 87000 },
        { month: 'Feb 2025', cashflow: 62000, runway: 23.2, inflow: 152000, outflow: 90000 },
        { month: 'Mar 2025', cashflow: 66000, runway: 24.5, inflow: 158000, outflow: 92000 },
        { month: 'Apr 2025', cashflow: 59000, runway: 23.8, inflow: 148000, outflow: 89000 },
        { month: 'May 2025', cashflow: 63000, runway: 24.2, inflow: 155000, outflow: 92000 },
        { month: 'Jun 2025', cashflow: 68000, runway: 25.1, inflow: 162000, outflow: 94000 }
      ]
    },
    {
      id: '3',
      name: 'Current Plan',
      color: '#17B6C3',
      style: 'line' as const,
      data: [
        { month: 'Jan 2025', cashflow: 48327, runway: 18.5, inflow: 127500, outflow: 79173 },
        { month: 'Feb 2025', cashflow: 51200, runway: 19.1, inflow: 132000, outflow: 80800 },
        { month: 'Mar 2025', cashflow: 54800, runway: 19.8, inflow: 137500, outflow: 82700 },
        { month: 'Apr 2025', cashflow: 49500, runway: 19.2, inflow: 130000, outflow: 80500 },
        { month: 'May 2025', cashflow: 52300, runway: 19.6, inflow: 134500, outflow: 82200 },
        { month: 'Jun 2025', cashflow: 56100, runway: 20.3, inflow: 140000, outflow: 83900 }
      ]
    }
  ], []);

  const mockTimelineData = useMemo(() => [
    {
      date: '2025-01-01',
      timestamp: new Date('2025-01-01').getTime(),
      cashflow: 48327,
      cumulativeCash: 246230,
      runway: 18.5,
      projectedMin: 45000,
      projectedMax: 52000,
      events: []
    },
    {
      date: '2025-02-01',
      timestamp: new Date('2025-02-01').getTime(),
      cashflow: 51200,
      cumulativeCash: 297430,
      runway: 19.1,
      projectedMin: 48000,
      projectedMax: 55000,
      events: [
        {
          date: '2025-02-15',
          type: 'payment' as const,
          title: 'Major Client Payment',
          amount: 75000,
          description: 'Large contract payment expected',
          severity: 'low' as const
        }
      ]
    },
    {
      date: '2025-03-01',
      timestamp: new Date('2025-03-01').getTime(),
      cashflow: 54800,
      cumulativeCash: 352230,
      runway: 19.8,
      projectedMin: 51000,
      projectedMax: 58000,
      events: []
    }
  ], []);

  const mockWaterfallData = useMemo(() => [
    {
      category: 'starting',
      label: 'Starting Cash',
      amount: 246230,
      type: 'start' as const,
      description: 'Beginning cash position'
    },
    {
      category: 'revenue',
      label: 'Collections',
      amount: 127500,
      type: 'positive' as const,
      description: 'Customer payments received'
    },
    {
      category: 'revenue',
      label: 'New Sales',
      amount: 25000,
      type: 'positive' as const,
      description: 'New contract revenue'
    },
    {
      category: 'expenses',
      label: 'Operating Costs',
      amount: -65000,
      type: 'negative' as const,
      description: 'Monthly operational expenses'
    },
    {
      category: 'expenses',
      label: 'Payroll',
      amount: -35000,
      type: 'negative' as const,
      description: 'Employee salaries and benefits'
    },
    {
      category: 'total',
      label: 'Ending Cash',
      amount: 298730,
      type: 'total' as const,
      description: 'Projected end-of-period cash'
    }
  ], []);

  const mockHeatmapData = useMemo(() => [
    {
      x: 'Jan 2025',
      y: 'Customer Risk',
      value: 65,
      severity: 'medium' as const,
      trend: 'up' as const,
      events: [
        { title: 'Payment Delay Risk', description: 'Client ABC payment delayed', impact: 15000 }
      ]
    },
    {
      x: 'Feb 2025',
      y: 'Customer Risk',
      value: 45,
      severity: 'low' as const,
      trend: 'down' as const,
      events: []
    },
    {
      x: 'Jan 2025',
      y: 'Market Risk',
      value: 35,
      severity: 'low' as const,
      trend: 'stable' as const,
      events: []
    },
    {
      x: 'Feb 2025',
      y: 'Market Risk',
      value: 55,
      severity: 'medium' as const,
      trend: 'up' as const,
      events: [
        { title: 'Economic Uncertainty', description: 'Industry outlook mixed', impact: 8000 }
      ]
    },
    {
      x: 'Jan 2025',
      y: 'Operational Risk',
      value: 75,
      severity: 'high' as const,
      trend: 'up' as const,
      events: [
        { title: 'Collection Efficiency', description: 'DSO increasing', impact: 12000 }
      ]
    },
    {
      x: 'Feb 2025',
      y: 'Operational Risk',
      value: 60,
      severity: 'medium' as const,
      trend: 'down' as const,
      events: []
    }
  ], []);

  // Action callbacks for advanced features
  const handleExportReport = useCallback(() => {
    const data = {
      scenarios: savedScenarios,
      currentData: currentCashData,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cashflow-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Report Exported",
      description: "Cashflow report has been downloaded successfully",
    });
  }, [savedScenarios, currentCashData, toast]);

  const handleNewScenario = useCallback(() => {
    setNewScenarioName('');
    setScenarioInputs({
      collectionRate: [75],
      paymentDelays: [15],
      newInvoices: [25000],
      expenseChanges: [0]
    });
    
    toast({
      title: "New Scenario",
      description: "Scenario inputs have been reset. Configure and save when ready.",
    });
  }, [toast]);

  const handleToggleAdvancedView = useCallback(() => {
    setAdvancedViewMode(prev => prev === 'standard' ? 'advanced' : 'standard');
    toast({
      title: `${advancedViewMode === 'standard' ? 'Advanced' : 'Standard'} View Enabled`,
      description: `Switched to ${advancedViewMode === 'standard' ? 'advanced charts and analysis' : 'standard view'}`,
    });
  }, [advancedViewMode, toast]);

  const handleToggleSidebar = useCallback(() => {
    setIsActionSidebarOpen(prev => !prev);
  }, []);

  // Calculate scenario impact
  const calculateScenarioImpact = (inputs = scenarioInputs) => {
    const baseCollection = 127500;
    const baseExpenses = 98200;
    
    const adjustedCollection = baseCollection * (inputs.collectionRate[0] / 100);
    const adjustedExpenses = baseExpenses * (1 + inputs.expenseChanges[0] / 100);
    const delayImpact = inputs.paymentDelays[0] * 1000; // rough calculation
    
    return {
      projectedInflow: adjustedCollection + inputs.newInvoices[0],
      projectedOutflow: adjustedExpenses,
      netImpact: (adjustedCollection + inputs.newInvoices[0]) - adjustedExpenses - delayImpact,
      newRunway: currentCashData.cashRunway + ((adjustedCollection - adjustedExpenses) / 10000)
    };
  };

  // Save current scenario
  const saveCurrentScenario = useCallback(() => {
    if (!newScenarioName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your scenario",
        variant: "destructive"
      });
      return;
    }

    const impact = calculateScenarioImpact();
    const newScenario: SavedScenario = {
      id: Date.now().toString(),
      name: newScenarioName,
      description: `Collection: ${scenarioInputs.collectionRate[0]}%, Delays: ${scenarioInputs.paymentDelays[0]} days`,
      inputs: { ...scenarioInputs },
      impact,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setSavedScenarios(prev => [...prev, newScenario]);
    setNewScenarioName('');
    toast({
      title: "Scenario Saved",
      description: `"${newScenario.name}" has been saved successfully`
    });
  }, [newScenarioName, scenarioInputs, calculateScenarioImpact, toast]);

  // Keyboard shortcuts setup
  const keyboardShortcuts = useMemo(() => [
    ...getCommonShortcuts({
      save: () => {
        if (newScenarioName.trim()) {
          saveCurrentScenario();
        } else {
          toast({
            title: "Save Scenario",
            description: "Please enter a scenario name first",
            variant: "destructive"
          });
        }
      },
      new: handleNewScenario,
      export: handleExportReport,
      help: () => setShowKeyboardShortcuts(true),
      toggleSidebar: handleToggleSidebar,
    }),
    ...getTabNavigationShortcuts([
      { id: 'scenario', name: 'Scenario Planning', action: () => setActiveTab('scenario') },
      { id: 'collection', name: 'Collection Optimization', action: () => setActiveTab('collection') },
      { id: 'insights', name: 'AI Insights', action: () => setActiveTab('insights') },
      { id: 'risk', name: 'Risk Analysis', action: () => setActiveTab('risk') }
    ]),
    {
      key: 'v',
      ctrl: true,
      description: 'Toggle advanced view mode',
      action: handleToggleAdvancedView,
      category: 'Views',
    },
    {
      key: 'p',
      ctrl: true,
      description: 'Open user preferences',
      action: () => setShowUserPreferences(true),
      category: 'Settings',
    }
  ], [
    newScenarioName, 
    saveCurrentScenario, 
    handleNewScenario, 
    handleExportReport, 
    handleToggleSidebar, 
    handleToggleAdvancedView, 
    toast
  ]);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: keyboardShortcuts,
    disabled: !userPreferences.enableKeyboardShortcuts,
  });

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Smart defaults logic - auto-select most relevant view based on cash runway
  useEffect(() => {
    if (currentCashData.cashRunway < 6) {
      setActiveTab("risk"); // Critical cash runway - focus on risk analysis
    } else if (currentCashData.cashRunway < 12) {
      setActiveTab("collection"); // Medium runway - focus on collections
    } else {
      setActiveTab("scenario"); // Healthy runway - focus on scenario planning
    }
  }, []);

  // Initialize sample data
  useEffect(() => {
    // Sample saved scenarios
    setSavedScenarios([
      {
        id: '1',
        name: 'Conservative Growth',
        description: 'Lower collection rate, stable expenses',
        inputs: {
          collectionRate: [70],
          paymentDelays: [20],
          newInvoices: [20000],
          expenseChanges: [5]
        },
        impact: {
          netImpact: -5200,
          projectedInflow: 160000,
          projectedOutflow: 103110,
          newRunway: 17.8
        },
        createdAt: '2025-09-10'
      },
      {
        id: '2',
        name: 'Aggressive Collection',
        description: 'High collection rate, reduced delays',
        inputs: {
          collectionRate: [85],
          paymentDelays: [8],
          newInvoices: [30000],
          expenseChanges: [-5]
        },
        impact: {
          netImpact: 12400,
          projectedInflow: 188375,
          projectedOutflow: 93290,
          newRunway: 19.7
        },
        createdAt: '2025-09-11'
      }
    ]);
  }, []);

  // Load saved scenario
  const loadScenario = (scenario: SavedScenario) => {
    setScenarioInputs({ ...scenario.inputs });
    toast({
      title: "Scenario Loaded",
      description: `"${scenario.name}" parameters applied`
    });
  };

  // Delete saved scenario
  const deleteScenario = (scenarioId: string) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== scenarioId));
    setSelectedScenarios(prev => prev.filter(id => id !== scenarioId));
    toast({
      title: "Scenario Deleted",
      description: "Scenario has been removed"
    });
  };

  // Toggle scenario selection for comparison
  const toggleScenarioSelection = (scenarioId: string) => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioId) 
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId].slice(-3) // Max 3 comparisons
    );
  };

  // Run stress test
  const runStressTest = () => {
    const scenarios = [
      { name: 'Mild Recession', collectionRate: [65], paymentDelays: [25], expenseChanges: [10] },
      { name: 'Severe Recession', collectionRate: [55], paymentDelays: [35], expenseChanges: [15] },
      { name: 'Economic Growth', collectionRate: [85], paymentDelays: [10], expenseChanges: [-5] }
    ];

    const results = scenarios.map(scenario => ({
      ...scenario,
      impact: calculateScenarioImpact({ 
        ...scenarioInputs, 
        ...scenario,
        newInvoices: scenarioInputs.newInvoices
      })
    }));

    setStressTestResults(results);
    toast({
      title: "Stress Test Complete",
      description: "Economic scenario analysis ready"
    });
  };

  const scenarioImpact = calculateScenarioImpact();

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

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  // Action sidebar content based on active tab
  const getActionSidebarContent = () => {
    switch (activeTab) {
      case 'scenario':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Button size="sm" variant="outline" className="w-full justify-start" onClick={runStressTest} data-testid="button-stress-test">
                  <Activity className="h-4 w-4 mr-2" />
                  Run Stress Test
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start" data-testid="button-export-scenario">
                  <Download className="h-4 w-4 mr-2" />
                  Export Analysis
                </Button>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-semibold mb-3">Save Current Scenario</h3>
              <div className="space-y-3">
                <Input 
                  placeholder="Scenario name"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  data-testid="input-scenario-name"
                />
                <Button size="sm" onClick={saveCurrentScenario} className="w-full" data-testid="button-save-scenario">
                  <Save className="h-4 w-4 mr-2" />
                  Save Scenario
                </Button>
              </div>
            </div>

            {savedScenarios.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3">Saved Scenarios</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {savedScenarios.map(scenario => (
                      <div key={scenario.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{scenario.name}</h4>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => loadScenario(scenario)}
                              data-testid={`button-load-${scenario.id}`}
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => deleteScenario(scenario.id)}
                              data-testid={`button-delete-${scenario.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{scenario.description}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-medium ${
                            scenario.impact.netImpact >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {scenario.impact.netImpact >= 0 ? '+' : ''}${Math.round(scenario.impact.netImpact).toLocaleString()}
                          </span>
                          <span className="text-gray-500">{scenario.createdAt}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      
      case 'collection':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Priority Actions</h3>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Overdue: $89,200</p>
                      <p className="text-xs text-gray-600">3 customers need immediate follow-up</p>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full justify-start" data-testid="button-collection-followup">
                  <Phone className="h-4 w-4 mr-2" />
                  Schedule Follow-ups
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start" data-testid="button-collection-email">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Payment Reminders
                </Button>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-semibold mb-3">Collection Strategies</h3>
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Early Payment Discounts</span>
                    <Badge variant="secondary">85% effective</Badge>
                  </div>
                  <p className="text-xs text-gray-600">2% discount for payments within 10 days</p>
                  <div className="text-xs text-green-600 mt-1">ROI: 340%</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Automated Reminders</span>
                    <Badge variant="secondary">72% effective</Badge>
                  </div>
                  <p className="text-xs text-gray-600">Email sequence starting 5 days before due</p>
                  <div className="text-xs text-green-600 mt-1">ROI: 1,200%</div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'risk':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Emergency Actions</h3>
              <div className="space-y-3">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Timer className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Runway: 18.5 months</p>
                      <p className="text-xs text-gray-600">Above critical threshold</p>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full justify-start" onClick={runStressTest} data-testid="button-risk-stress-test">
                  <Shield className="h-4 w-4 mr-2" />
                  Run Stress Test
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start" data-testid="button-risk-mitigation">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Review Mitigation Plan
                </Button>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-semibold mb-3">Risk Monitoring</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Concentration Risk</span>
                  <Badge variant="destructive">High</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Seasonal Variance</span>
                  <Badge variant="secondary">Medium</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Market Conditions</span>
                  <Badge variant="outline">Stable</Badge>
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen page-gradient">
      <NewSidebar />
      <div className="flex-1 flex">
        <main className="flex-1 overflow-y-auto">
          <Header 
            title="Cash Flow Command Center" 
            subtitle="Real-time cash management and scenario planning"
            action={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleAdvancedView}
                  className={advancedViewMode === 'advanced' ? 'bg-[#17B6C3]/10 border-[#17B6C3]' : ''}
                  data-testid="button-toggle-view-mode"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {advancedViewMode === 'advanced' ? 'Advanced' : 'Standard'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKeyboardShortcuts(true)}
                  data-testid="button-keyboard-shortcuts"
                  title="Keyboard Shortcuts (? key)"
                >
                  <Calculator className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUserPreferences(true)}
                  data-testid="button-user-preferences"
                  title="User Preferences (Ctrl+P)"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            }
          />
        
        {/* Command Center Header - Sticky */}
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4 lg:hidden">
              <h1 className="text-xl font-bold">Cash Flow Command</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsActionSidebarOpen(true)}
                data-testid="button-mobile-actions"
              >
                <Menu className="h-4 w-4" />
                Actions
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {/* Real-time Cash Position */}
              <Card className="relative overflow-hidden bg-gradient-to-r from-[#17B6C3]/10 to-[#17B6C3]/5 border-[#17B6C3]/20" data-testid="header-cash-position">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Available</p>
                      <p className="text-2xl font-bold text-[#17B6C3]" data-testid="text-header-cash-total">
                        ${currentCashData.totalAvailable.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <DollarSign className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                  </div>
                  <div className="flex items-center mt-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">Healthy Position</span>
                  </div>
                </CardContent>
              </Card>

              {/* Critical Actions Counter */}
              <Card className="relative overflow-hidden" data-testid="header-critical-actions">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Critical Actions</p>
                      <p className="text-2xl font-bold text-orange-600" data-testid="text-header-critical-count">
                        {criticalActions}
                      </p>
                    </div>
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                    </div>
                  </div>
                  <div className="flex items-center mt-2">
                    <Clock className="h-4 w-4 text-orange-500 mr-1" />
                    <span className="text-sm text-orange-600">Need attention</span>
                  </div>
                </CardContent>
              </Card>

              {/* Cash Runway */}
              <Card className="relative overflow-hidden" data-testid="header-cash-runway">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Cash Runway</p>
                      <p className="text-2xl font-bold text-gray-900" data-testid="text-header-runway">
                        {currentCashData.cashRunway.toFixed(1)} mo
                      </p>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Timer className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">Stable runway</span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="relative overflow-hidden" data-testid="header-quick-actions">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-600">Quick Actions</p>
                    <RefreshCw className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full text-xs h-7"
                      data-testid="button-sync-data"
                    >
                      Sync Data
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="w-full text-xs h-7"
                      data-testid="button-export-report"
                    >
                      Export Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Tabbed Workspace */}
        <div className="p-4 lg:p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className={`grid w-full max-w-md grid-cols-3 ${isMobile ? 'text-xs' : ''}`} data-testid="tabs-command-center">
                <TabsTrigger value="scenario" className="flex items-center gap-1 lg:gap-2" data-testid="tab-scenario">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Scenario Planning</span>
                  <span className="sm:hidden">Scenario</span>
                </TabsTrigger>
                <TabsTrigger value="collection" className="flex items-center gap-1 lg:gap-2" data-testid="tab-collection">
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline">Collection Strategy</span>
                  <span className="sm:hidden">Collection</span>
                </TabsTrigger>
                <TabsTrigger value="risk" className="flex items-center gap-1 lg:gap-2" data-testid="tab-risk">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Risk Analysis</span>
                  <span className="sm:hidden">Risk</span>
                </TabsTrigger>
              </TabsList>
              
              {/* Action Sidebar Toggle for Desktop */}
              {!isMobile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsActionSidebarOpen(!isActionSidebarOpen)}
                  data-testid="button-toggle-actions"
                >
                  {isActionSidebarOpen ? (
                    <><X className="h-4 w-4 mr-2" />Close Actions</>
                  ) : (
                    <><Settings className="h-4 w-4 mr-2" />Actions</>
                  )}
                </Button>
              )}
            </div>

            {/* Scenario Planning Tab */}
            <TabsContent value="scenario" className="space-y-6">
              {/* Scenario Comparison Table */}
              {selectedScenarios.length > 0 && (
                <Card className="card-glass mb-6" data-testid="card-scenario-comparison">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-[#17B6C3]" />
                      Scenario Comparison
                    </CardTitle>
                    <p className="text-sm text-gray-600">Compare multiple scenarios side by side</p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium">Metric</th>
                            <th className="text-center p-3 font-medium">Current</th>
                            {selectedScenarios.map(scenarioId => {
                              const scenario = savedScenarios.find(s => s.id === scenarioId);
                              return scenario ? (
                                <th key={scenarioId} className="text-center p-3 font-medium">
                                  {scenario.name}
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => toggleScenarioSelection(scenarioId)}
                                    className="ml-2"
                                    data-testid={`button-remove-comparison-${scenarioId}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </th>
                              ) : null;
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-3 font-medium">Collection Rate</td>
                            <td className="text-center p-3">{scenarioInputs.collectionRate[0]}%</td>
                            {selectedScenarios.map(scenarioId => {
                              const scenario = savedScenarios.find(s => s.id === scenarioId);
                              return scenario ? (
                                <td key={scenarioId} className="text-center p-3">
                                  {scenario.inputs.collectionRate[0]}%
                                </td>
                              ) : null;
                            })}
                          </tr>
                          <tr className="border-b">
                            <td className="p-3 font-medium">Payment Delays</td>
                            <td className="text-center p-3">{scenarioInputs.paymentDelays[0]} days</td>
                            {selectedScenarios.map(scenarioId => {
                              const scenario = savedScenarios.find(s => s.id === scenarioId);
                              return scenario ? (
                                <td key={scenarioId} className="text-center p-3">
                                  {scenario.inputs.paymentDelays[0]} days
                                </td>
                              ) : null;
                            })}
                          </tr>
                          <tr className="border-b">
                            <td className="p-3 font-medium">Net Impact</td>
                            <td className={`text-center p-3 font-semibold ${
                              scenarioImpact.netImpact >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {scenarioImpact.netImpact >= 0 ? '+' : ''}${Math.round(scenarioImpact.netImpact).toLocaleString()}
                            </td>
                            {selectedScenarios.map(scenarioId => {
                              const scenario = savedScenarios.find(s => s.id === scenarioId);
                              return scenario ? (
                                <td key={scenarioId} className={`text-center p-3 font-semibold ${
                                  scenario.impact.netImpact >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {scenario.impact.netImpact >= 0 ? '+' : ''}${Math.round(scenario.impact.netImpact).toLocaleString()}
                                </td>
                              ) : null;
                            })}
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">Cash Runway</td>
                            <td className="text-center p-3">{scenarioImpact.newRunway.toFixed(1)} mo</td>
                            {selectedScenarios.map(scenarioId => {
                              const scenario = savedScenarios.find(s => s.id === scenarioId);
                              return scenario ? (
                                <td key={scenarioId} className="text-center p-3">
                                  {scenario.impact.newRunway.toFixed(1)} mo
                                </td>
                              ) : null;
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stress Test Results */}
              {stressTestResults && (
                <Card className="card-glass mb-6" data-testid="card-stress-test-results">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-red-500" />
                      Economic Stress Test Results
                    </CardTitle>
                    <p className="text-sm text-gray-600">How your cash flow performs under different economic conditions</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {stressTestResults.map((result: any, index: number) => (
                        <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">{result.name}</h4>
                            <Badge variant={result.impact.netImpact >= 0 ? "default" : "destructive"}>
                              {result.impact.netImpact >= 0 ? 'Positive' : 'Negative'}
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Collection Rate:</span>
                              <span>{result.collectionRate[0]}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Avg Delays:</span>
                              <span>{result.paymentDelays[0]} days</span>
                            </div>
                            <Separator className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>Net Impact:</span>
                              <span className={result.impact.netImpact >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {result.impact.netImpact >= 0 ? '+' : ''}${Math.round(result.impact.netImpact).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Runway:</span>
                              <span>{result.impact.newRunway.toFixed(1)} months</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Scenario Builder */}
                <Card className="card-glass" data-testid="card-scenario-builder">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-[#17B6C3]" />
                          What-If Scenario Builder
                        </CardTitle>
                        <p className="text-sm text-gray-600">Adjust parameters to see immediate impact</p>
                      </div>
                      <Button variant="outline" size="sm" data-testid="button-reset-scenario">
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Collection Rate Slider */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Collection Rate</label>
                        <span className="text-sm text-[#17B6C3] font-semibold">{scenarioInputs.collectionRate[0]}%</span>
                      </div>
                      <Slider
                        value={scenarioInputs.collectionRate}
                        onValueChange={(value) => setScenarioInputs(prev => ({...prev, collectionRate: value}))}
                        max={100}
                        min={50}
                        step={5}
                        className="w-full"
                        data-testid="slider-collection-rate"
                      />
                      <p className="text-xs text-gray-500">Expected percentage of invoices collected</p>
                    </div>

                    {/* Payment Delays Slider */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Average Payment Delays</label>
                        <span className="text-sm text-orange-600 font-semibold">{scenarioInputs.paymentDelays[0]} days</span>
                      </div>
                      <Slider
                        value={scenarioInputs.paymentDelays}
                        onValueChange={(value) => setScenarioInputs(prev => ({...prev, paymentDelays: value}))}
                        max={60}
                        min={0}
                        step={5}
                        className="w-full"
                        data-testid="slider-payment-delays"
                      />
                      <p className="text-xs text-gray-500">Days beyond due date for payment collection</p>
                    </div>

                    {/* New Invoices Slider */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">New Invoice Volume</label>
                        <span className="text-sm text-green-600 font-semibold">${scenarioInputs.newInvoices[0].toLocaleString()}</span>
                      </div>
                      <Slider
                        value={scenarioInputs.newInvoices}
                        onValueChange={(value) => setScenarioInputs(prev => ({...prev, newInvoices: value}))}
                        max={50000}
                        min={5000}
                        step={5000}
                        className="w-full"
                        data-testid="slider-new-invoices"
                      />
                      <p className="text-xs text-gray-500">Additional monthly invoice volume</p>
                    </div>

                    {/* Expense Changes Slider */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Expense Changes</label>
                        <span className={`text-sm font-semibold ${scenarioInputs.expenseChanges[0] >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {scenarioInputs.expenseChanges[0] >= 0 ? '+' : ''}{scenarioInputs.expenseChanges[0]}%
                        </span>
                      </div>
                      <Slider
                        value={scenarioInputs.expenseChanges}
                        onValueChange={(value) => setScenarioInputs(prev => ({...prev, expenseChanges: value}))}
                        max={50}
                        min={-25}
                        step={5}
                        className="w-full"
                        data-testid="slider-expense-changes"
                      />
                      <p className="text-xs text-gray-500">Percentage change in operating expenses</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Scenario Impact Visualization */}
                <Card className="card-glass" data-testid="card-scenario-impact">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Activity className="h-5 w-5 text-[#17B6C3]" />
                      Impact Analysis
                    </CardTitle>
                    <p className="text-sm text-gray-600">Real-time scenario outcomes</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Net Impact */}
                    <div className="text-center p-6 bg-gradient-to-b from-[#17B6C3]/5 to-transparent rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Net Cash Impact</p>
                      <p className={`text-3xl font-bold ${scenarioImpact.netImpact >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-scenario-net-impact">
                        {scenarioImpact.netImpact >= 0 ? '+' : ''}${Math.round(scenarioImpact.netImpact).toLocaleString()}
                      </p>
                      <div className="flex items-center justify-center mt-2">
                        {scenarioImpact.netImpact >= 0 ? 
                          <TrendingUp className="h-4 w-4 text-green-500 mr-1" /> : 
                          <TrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
                        }
                        <span className={`text-sm ${scenarioImpact.netImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          vs current projection
                        </span>
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm">Projected Inflow</span>
                        <span className="font-semibold text-green-600" data-testid="text-scenario-inflow">
                          +${Math.round(scenarioImpact.projectedInflow).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm">Projected Outflow</span>
                        <span className="font-semibold text-red-600" data-testid="text-scenario-outflow">
                          -${Math.round(scenarioImpact.projectedOutflow).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm">New Cash Runway</span>
                        <span className="font-semibold text-[#17B6C3]" data-testid="text-scenario-runway">
                          {scenarioImpact.newRunway.toFixed(1)} months
                        </span>
                      </div>
                    </div>

                    {/* Action Recommendation */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Recommendation</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            {scenarioImpact.netImpact >= 0 
                              ? "This scenario improves your cash position. Consider implementing these changes." 
                              : "This scenario has negative impact. Review and adjust parameters before implementing."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Advanced Visualizations - Only show in advanced mode */}
              {advancedViewMode === 'advanced' && (
                <div className="space-y-8">
                  <div className="text-center py-4">
                    <Badge variant="outline" className="bg-[#17B6C3]/10 border-[#17B6C3] text-[#17B6C3]">
                      Advanced Analytics Mode
                    </Badge>
                  </div>

                  {/* Advanced Chart Grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Scenario Comparison Chart */}
                    <Suspense fallback={
                      <div className="flex items-center justify-center p-8 xl:col-span-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#17B6C3]"></div>
                        <span className="ml-2 text-sm text-gray-600">Loading chart...</span>
                      </div>
                    }>
                      <ScenarioComparisonChart
                        scenarios={mockScenarioData}
                        onExport={(format) => {
                          toast({
                            title: "Chart Exported",
                            description: `Scenario comparison chart exported as ${format.toUpperCase()}`,
                          });
                        }}
                        className="xl:col-span-2"
                      />
                    </Suspense>

                    {/* Timeline Visualization */}
                    <TimelineVisualization
                      data={mockTimelineData}
                      events={[
                        {
                          date: '2025-02-15',
                          type: 'payment',
                          title: 'Major Client Payment',
                          amount: 75000,
                          description: 'Large contract payment expected'
                        },
                        {
                          date: '2025-03-01',
                          type: 'milestone',
                          title: 'Quarterly Review',
                          description: 'Q1 financial review and planning'
                        }
                      ]}
                      onEventClick={(event) => {
                        toast({
                          title: "Event Details",
                          description: event.description,
                        });
                      }}
                    />

                    {/* Waterfall Chart */}
                    <Suspense fallback={
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#17B6C3]"></div>
                        <span className="ml-2 text-sm text-gray-600">Loading waterfall...</span>
                      </div>
                    }>
                      <WaterfallChart
                        components={mockWaterfallData}
                        title="Cash Flow Breakdown"
                        subtitle="Monthly cash flow component analysis"
                        onExport={() => {
                          toast({
                            title: "Waterfall Chart Exported",
                            description: "Cash flow breakdown exported successfully",
                          });
                        }}
                      />
                    </Suspense>
                  </div>

                  {/* Risk Heatmap - Full Width */}
                  <Suspense fallback={
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#17B6C3]"></div>
                      <span className="ml-2 text-sm text-gray-600">Loading heatmap...</span>
                    </div>
                  }>
                    <HeatmapVisualization
                      data={mockHeatmapData}
                      onCellClick={(cell) => {
                        toast({
                          title: `Risk Factor: ${cell.y}`,
                          description: `${cell.x} - Severity: ${cell.severity} (${cell.value}/100)`,
                        });
                      }}
                      onExport={() => {
                        toast({
                          title: "Heatmap Exported",
                          description: "Risk factor heatmap exported successfully",
                        });
                      }}
                    />
                  </Suspense>
                </div>
              )}
            </TabsContent>

            {/* Collection Strategy Tab */}
            <TabsContent value="collection" className="space-y-6">
              {/* Collection Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="card-glass" data-testid="card-collection-effectiveness">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Overall Effectiveness</p>
                        <p className="text-2xl font-bold text-[#17B6C3]">74.2%</p>
                      </div>
                      <Target className="h-8 w-8 text-[#17B6C3]" />
                    </div>
                    <div className="mt-2">
                      <Progress value={74.2} className="h-2" />
                      <p className="text-xs text-gray-500 mt-1">+2.3% from last month</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass" data-testid="card-average-collection-time">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Avg Collection Time</p>
                        <p className="text-2xl font-bold text-orange-600">18.5</p>
                      </div>
                      <Clock className="h-8 w-8 text-orange-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">days (target: 15 days)</p>
                      <div className="flex items-center mt-1">
                        <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-600">-1.2 days improvement</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass" data-testid="card-collection-velocity">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Payment Velocity</p>
                        <p className="text-2xl font-bold text-green-600">$127K</p>
                      </div>
                      <Activity className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">per week collected</p>
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-600">+8.4% this month</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass" data-testid="card-collection-roi">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Strategy ROI</p>
                        <p className="text-2xl font-bold text-green-600">340%</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">return on collection costs</p>
                      <div className="flex items-center mt-1">
                        <DollarSign className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-600">$3.40 per $1 invested</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Strategy Analysis */}
                <div className="lg:col-span-2">
                  <Card className="card-glass" data-testid="card-collection-strategy-analysis">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold">Strategy Effectiveness Analysis</CardTitle>
                      <p className="text-sm text-gray-600">Performance breakdown by collection method</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Strategy Performance List */}
                      <div className="space-y-4">
                        {[
                          {
                            name: 'Early Payment Discounts',
                            effectiveness: 85,
                            avgTime: 12,
                            cost: 850,
                            roi: 340,
                            description: '2% discount for payments within 10 days'
                          },
                          {
                            name: 'Automated Email Reminders',
                            effectiveness: 72,
                            avgTime: 18,
                            cost: 120,
                            roi: 1200,
                            description: 'Email sequence starting 5 days before due date'
                          },
                          {
                            name: 'Personal Phone Follow-up',
                            effectiveness: 68,
                            avgTime: 22,
                            cost: 2400,
                            roi: 180,
                            description: 'Direct calls for amounts over $5,000'
                          },
                          {
                            name: 'Payment Plan Offers',
                            effectiveness: 58,
                            avgTime: 35,
                            cost: 300,
                            roi: 220,
                            description: 'Structured payment plans for overdue accounts'
                          }
                        ].map((strategy, index) => (
                          <div key={index} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  strategy.effectiveness >= 80 ? 'bg-green-500' :
                                  strategy.effectiveness >= 70 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`} />
                                <h4 className="font-semibold">{strategy.name}</h4>
                              </div>
                              <div className="flex items-center gap-4">
                                <Badge variant="secondary" data-testid={`badge-effectiveness-${index}`}>
                                  {strategy.effectiveness}% effective
                                </Badge>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-green-600">ROI: {strategy.roi}%</p>
                                  <p className="text-xs text-gray-500">Cost: ${strategy.cost}/mo</p>
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{strategy.description}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-sm">
                                <span>Avg Collection: {strategy.avgTime} days</span>
                                <Progress value={strategy.effectiveness} className="w-24 h-2" />
                              </div>
                              <Button size="sm" variant="outline" data-testid={`button-optimize-${index}`}>
                                <Settings className="h-4 w-4 mr-1" />
                                Optimize
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* ROI Calculator */}
                      <Separator />
                      <div className="p-4 bg-[#17B6C3]/5 rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          ROI Calculator
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs">Monthly Collection Cost</Label>
                            <Input placeholder="$2,000" className="mt-1" data-testid="input-collection-cost" />
                          </div>
                          <div>
                            <Label className="text-xs">Additional Collections</Label>
                            <Input placeholder="$15,000" className="mt-1" data-testid="input-additional-collections" />
                          </div>
                          <div className="flex items-end">
                            <Button size="sm" className="w-full" data-testid="button-calculate-roi">
                              Calculate ROI
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Customer Payment Velocity & Priority Actions */}
                <div className="space-y-6">
                  {/* High Priority Customers */}
                  <Card className="card-glass" data-testid="card-priority-customers">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg font-bold">Priority Customers</CardTitle>
                          <p className="text-sm text-gray-600">Requiring immediate attention</p>
                        </div>
                        <Badge variant="destructive" data-testid="badge-priority-count">3 urgent</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          {
                            name: 'TechCorp Solutions',
                            amount: 25000,
                            daysOverdue: 8,
                            paymentVelocity: 'Declining',
                            riskLevel: 'High',
                            lastContact: '3 days ago'
                          },
                          {
                            name: 'Global Manufacturing',
                            amount: 18750,
                            daysOverdue: 15,
                            paymentVelocity: 'Stable',
                            riskLevel: 'Medium',
                            lastContact: '1 week ago'
                          },
                          {
                            name: 'Retail Partners Inc',
                            amount: 12400,
                            daysOverdue: 22,
                            paymentVelocity: 'Improving',
                            riskLevel: 'Low',
                            lastContact: '2 days ago'
                          }
                        ].map((customer, index) => (
                          <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium text-sm">{customer.name}</p>
                                <p className="text-xs text-gray-500">{customer.daysOverdue} days overdue</p>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-red-600" data-testid={`text-customer-amount-${index}`}>
                                  ${customer.amount.toLocaleString()}
                                </span>
                                <Badge 
                                  variant={customer.riskLevel === 'High' ? 'destructive' : customer.riskLevel === 'Medium' ? 'secondary' : 'outline'}
                                  className="ml-2 text-xs"
                                >
                                  {customer.riskLevel}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                              <span>Velocity: {customer.paymentVelocity}</span>
                              <span>Last contact: {customer.lastContact}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1" data-testid={`button-call-customer-${index}`}>
                                <Phone className="h-3 w-3 mr-1" />
                                Call
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1" data-testid={`button-email-customer-${index}`}>
                                <Mail className="h-3 w-3 mr-1" />
                                Email
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1" data-testid={`button-schedule-customer-${index}`}>
                                <CalendarIcon className="h-3 w-3 mr-1" />
                                Schedule
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payment Velocity Trends */}
                  <Card className="card-glass" data-testid="card-payment-velocity">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold">Payment Velocity Trends</CardTitle>
                      <p className="text-sm text-gray-600">Customer payment behavior analysis</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                          <span className="text-sm">Fast Payers (≤15 days)</span>
                          <div className="flex items-center gap-2">
                            <Progress value={65} className="w-16 h-2" />
                            <span className="text-sm font-medium">65%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                          <span className="text-sm">Standard Payers (16-30 days)</span>
                          <div className="flex items-center gap-2">
                            <Progress value={28} className="w-16 h-2" />
                            <span className="text-sm font-medium">28%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm">Slow Payers (30+ days)</span>
                          <div className="flex items-center gap-2">
                            <Progress value={7} className="w-16 h-2" />
                            <span className="text-sm font-medium text-red-600">7%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* AI Learning Insights Dashboard */}
              <div className="mt-8">
                <Suspense fallback={
                  <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#17B6C3]"></div>
                    <span className="ml-3 text-sm text-gray-600">Loading AI Learning Insights...</span>
                  </div>
                }>
                  <AILearningInsightsDashboard />
                </Suspense>
              </div>
            </TabsContent>

            {/* Risk Analysis Tab */}
            <TabsContent value="risk" className="space-y-6">
              {/* Risk Assessment Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="card-glass" data-testid="card-risk-score">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Overall Risk Score</p>
                        <p className="text-2xl font-bold text-yellow-600">6.2</p>
                      </div>
                      <div className={`p-3 rounded-lg ${
                        6.2 <= 3 ? 'bg-green-500/10' :
                        6.2 <= 7 ? 'bg-yellow-500/10' :
                        'bg-red-500/10'
                      }`}>
                        <Shield className={`h-6 w-6 ${
                          6.2 <= 3 ? 'text-green-500' :
                          6.2 <= 7 ? 'text-yellow-500' :
                          'text-red-500'
                        }`} />
                      </div>
                    </div>
                    <div className="mt-2">
                      <Progress value={(10 - 6.2) * 10} className="h-2" />
                      <p className="text-xs text-gray-500 mt-1">Medium risk level</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass" data-testid="card-early-warning">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Early Warning</p>
                        <p className="text-2xl font-bold text-orange-600">2</p>
                      </div>
                      <AlertCircle className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">indicators triggered</p>
                      <div className="flex items-center mt-1">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mr-2" />
                        <span className="text-xs text-orange-600">Requires monitoring</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass" data-testid="card-mitigation-status">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Mitigation Status</p>
                        <p className="text-2xl font-bold text-green-600">78%</p>
                      </div>
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="mt-2">
                      <Progress value={78} className="h-2" />
                      <p className="text-xs text-gray-500 mt-1">7 of 9 risks addressed</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass" data-testid="card-compliance">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Compliance</p>
                        <p className="text-2xl font-bold text-[#17B6C3]">95%</p>
                      </div>
                      <Star className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">regulatory requirements met</p>
                      <div className="flex items-center mt-1">
                        <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-600">All critical controls active</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Economic Scenario Modeling */}
                <Card className="card-glass" data-testid="card-economic-scenarios">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <TrendingDown className="h-5 w-5 text-red-500" />
                          Economic Scenario Analysis
                        </CardTitle>
                        <p className="text-sm text-gray-600">Cash flow impact under different economic conditions</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={runStressTest} data-testid="button-run-economic-analysis">
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Run Analysis
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        {
                          scenario: 'Economic Growth',
                          probability: 35,
                          cashflowImpact: 12400,
                          runwayImpact: 2.3,
                          indicators: ['GDP +3%', 'Low unemployment', 'Consumer confidence high']
                        },
                        {
                          scenario: 'Mild Recession',
                          probability: 45,
                          cashflowImpact: -8900,
                          runwayImpact: -3.1,
                          indicators: ['GDP -1%', 'Rising unemployment', 'Reduced spending']
                        },
                        {
                          scenario: 'Severe Recession',
                          probability: 20,
                          cashflowImpact: -24500,
                          runwayImpact: -6.8,
                          indicators: ['GDP -4%', 'High unemployment', 'Credit tightening']
                        }
                      ].map((scenario, index) => (
                        <div key={index} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${
                                scenario.scenario === 'Economic Growth' ? 'bg-green-500' :
                                scenario.scenario === 'Mild Recession' ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`} />
                              <h4 className="font-semibold">{scenario.scenario}</h4>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary">{scenario.probability}% likely</Badge>
                              <span className={`font-medium text-sm ${
                                scenario.cashflowImpact >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {scenario.cashflowImpact >= 0 ? '+' : ''}${Math.abs(scenario.cashflowImpact).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-600">Runway Impact:</p>
                            <span className={`text-xs font-medium ${
                              scenario.runwayImpact >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {scenario.runwayImpact >= 0 ? '+' : ''}{scenario.runwayImpact} months
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {scenario.indicators.map((indicator, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {indicator}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Mitigation Plan */}
                <Card className="card-glass" data-testid="card-mitigation-plan">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Shield className="h-5 w-5 text-[#17B6C3]" />
                      Risk Mitigation Plan
                    </CardTitle>
                    <p className="text-sm text-gray-600">Proactive measures and emergency procedures</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Risk Categories */}
                      {[
                        {
                          category: 'Concentration Risk',
                          severity: 'High',
                          risks: [
                            {
                              description: 'Top 3 customers = 45% of receivables',
                              impact: 'High',
                              mitigation: ['Diversify customer base', 'Set credit limits', 'Require deposits'],
                              status: 'In Progress'
                            }
                          ]
                        },
                        {
                          category: 'Operational Risk',
                          severity: 'Medium',
                          risks: [
                            {
                              description: 'Aging receivables over 30 days: $89k',
                              impact: 'Medium',
                              mitigation: ['Automated follow-up system', 'Early payment discounts', 'Collection agency partnership'],
                              status: 'Completed'
                            }
                          ]
                        },
                        {
                          category: 'Market Risk',
                          severity: 'Low',
                          risks: [
                            {
                              description: 'Seasonal payment variance Q4: -15%',
                              impact: 'Low',
                              mitigation: ['Cash reserves buildup', 'Seasonal pricing adjustments', 'Accelerated collections Q3'],
                              status: 'Planned'
                            }
                          ]
                        }
                      ].map((category, index) => (
                        <Collapsible key={index} open={expandedRiskCategory === category.category} onOpenChange={(open) => setExpandedRiskCategory(open ? category.category : null)}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" data-testid={`risk-category-${index}`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  category.severity === 'High' ? 'bg-red-500' :
                                  category.severity === 'Medium' ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`} />
                                <h4 className="font-medium">{category.category}</h4>
                                <Badge variant={category.severity === 'High' ? 'destructive' : category.severity === 'Medium' ? 'secondary' : 'outline'}>
                                  {category.severity}
                                </Badge>
                              </div>
                              {expandedRiskCategory === category.category ? 
                                <ChevronDown className="h-4 w-4" /> : 
                                <ChevronRight className="h-4 w-4" />
                              }
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3">
                            <div className="ml-6 space-y-3">
                              {category.risks.map((risk, riskIndex) => (
                                <div key={riskIndex} className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-start justify-between mb-2">
                                    <p className="text-sm font-medium">{risk.description}</p>
                                    <Badge variant={
                                      risk.status === 'Completed' ? 'default' :
                                      risk.status === 'In Progress' ? 'secondary' :
                                      'outline'
                                    }>
                                      {risk.status}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-gray-600 mb-2">Impact: {risk.impact}</p>
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Mitigation Actions:</p>
                                    <ul className="text-xs text-gray-600 space-y-1">
                                      {risk.mitigation.map((action, actionIndex) => (
                                        <li key={actionIndex} className="flex items-center gap-2">
                                          <div className="w-1 h-1 bg-[#17B6C3] rounded-full" />
                                          {action}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Early Warning Indicators */}
              <Card className="card-glass" data-testid="card-early-warning-indicators">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    Early Warning System
                  </CardTitle>
                  <p className="text-sm text-gray-600">Automated monitoring of key risk indicators</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      {
                        indicator: 'Cash Runway',
                        current: '18.5 months',
                        threshold: '< 12 months',
                        status: 'healthy',
                        trend: 'stable'
                      },
                      {
                        indicator: 'Collection Rate',
                        current: '74.2%',
                        threshold: '< 70%',
                        status: 'healthy',
                        trend: 'improving'
                      },
                      {
                        indicator: 'Overdue >30 Days',
                        current: '$89,200',
                        threshold: '> $100k',
                        status: 'warning',
                        trend: 'increasing'
                      },
                      {
                        indicator: 'Customer Concentration',
                        current: '45%',
                        threshold: '> 40%',
                        status: 'critical',
                        trend: 'stable'
                      },
                      {
                        indicator: 'Payment Velocity',
                        current: '18.5 days',
                        threshold: '> 25 days',
                        status: 'healthy',
                        trend: 'improving'
                      },
                      {
                        indicator: 'DSO Trend',
                        current: '42 days',
                        threshold: '> 45 days',
                        status: 'warning',
                        trend: 'increasing'
                      }
                    ].map((indicator, index) => (
                      <div key={index} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-testid={`warning-indicator-${index}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{indicator.indicator}</h4>
                          <div className={`w-3 h-3 rounded-full ${
                            indicator.status === 'healthy' ? 'bg-green-500' :
                            indicator.status === 'warning' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Current:</span>
                            <span className="font-medium">{indicator.current}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Threshold:</span>
                            <span className="font-medium">{indicator.threshold}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs mt-2">
                            <span className="text-gray-600">Trend:</span>
                            <div className="flex items-center gap-1">
                              {indicator.trend === 'improving' ? 
                                <TrendingUp className="h-3 w-3 text-green-500" /> :
                                indicator.trend === 'increasing' ?
                                <TrendingUp className="h-3 w-3 text-red-500" /> :
                                <div className="w-3 h-3 bg-gray-400 rounded-full" />
                              }
                              <span className={`font-medium ${
                                indicator.trend === 'improving' ? 'text-green-600' :
                                indicator.trend === 'increasing' ? 'text-red-600' :
                                'text-gray-600'
                              }`}>{indicator.trend}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      {/* Action Sidebar */}
      {!isMobile && isActionSidebarOpen && (
        <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Actions & Insights</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsActionSidebarOpen(false)}
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {getActionSidebarContent()}
        </div>
      )}
      
      {/* Mobile Action Sidebar */}
      {isMobile && (
        <Sheet open={isActionSidebarOpen} onOpenChange={setIsActionSidebarOpen}>
          <SheetContent side="right" className="w-full sm:w-96">
            <SheetHeader>
              <SheetTitle>Actions & Insights</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {getActionSidebarContent()}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Advanced Features Modals */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
        shortcuts={keyboardShortcuts}
        title="Cashflow Command Center Shortcuts"
      />

      <UserPreferencesPanel
        isOpen={showUserPreferences}
        onOpenChange={setShowUserPreferences}
        preferences={userPreferences}
        onPreferencesChange={setUserPreferences}
      />
      </div>
    </div>
  );
}