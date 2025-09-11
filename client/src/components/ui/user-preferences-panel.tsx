import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings,
  Palette,
  Bell,
  Download,
  Monitor,
  Moon,
  Sun,
  Smartphone,
  DollarSign,
  Calendar,
  BarChart3,
  Zap,
  RefreshCw,
  Save,
  RotateCcw,
  Trash2,
  Eye,
  EyeOff,
  Grid3X3,
  Layout,
  Move
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserPreferences {
  // Theme preferences
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  reducedMotion: boolean;
  compactMode: boolean;
  
  // Dashboard layout
  dashboardLayout: Array<{
    id: string;
    component: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    visible: boolean;
  }>;
  defaultTab: string;
  sidebarCollapsed: boolean;
  
  // Alert thresholds
  cashRunwayWarning: number; // months
  overduePaymentAlert: number; // days
  collectionTargetThreshold: number; // percentage
  automationAlerts: boolean;
  
  // Export preferences
  defaultExportFormat: 'xlsx' | 'csv' | 'pdf';
  defaultCurrency: string;
  defaultDateRange: '1m' | '3m' | '6m' | '1y';
  includeCharts: boolean;
  
  // Behavior preferences
  autoSaveScenarios: boolean;
  showTooltips: boolean;
  enableKeyboardShortcuts: boolean;
  animationsEnabled: boolean;
  
  // Quick actions
  quickActions: Array<{
    id: string;
    label: string;
    action: string;
    icon: string;
    enabled: boolean;
  }>;
}

interface UserPreferencesPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: UserPreferences;
  onPreferencesChange: (preferences: UserPreferences) => void;
  trigger?: React.ReactNode;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
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
  defaultExportFormat: 'xlsx',
  defaultCurrency: 'USD',
  defaultDateRange: '6m',
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
};

const ACCENT_COLORS = [
  { name: 'Nexus Teal', value: '#17B6C3' },
  { name: 'Ocean Blue', value: '#0EA5E9' },
  { name: 'Forest Green', value: '#059669' },
  { name: 'Sunset Orange', value: '#EA580C' },
  { name: 'Royal Purple', value: '#7C3AED' },
  { name: 'Rose Pink', value: '#E11D48' },
  { name: 'Slate Gray', value: '#475569' },
  { name: 'Emerald', value: '#10B981' }
];

export default function UserPreferencesPanel({
  isOpen,
  onOpenChange,
  preferences,
  onPreferencesChange,
  trigger
}: UserPreferencesPanelProps) {
  const { toast } = useToast();
  const [tempPreferences, setTempPreferences] = useState<UserPreferences>(preferences);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('appearance');

  useEffect(() => {
    setTempPreferences(preferences);
    setHasChanges(false);
  }, [preferences, isOpen]);

  useEffect(() => {
    const isChanged = JSON.stringify(tempPreferences) !== JSON.stringify(preferences);
    setHasChanges(isChanged);
  }, [tempPreferences, preferences]);

  const updatePreference = (key: keyof UserPreferences, value: any) => {
    setTempPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateQuickAction = (id: string, updates: Partial<UserPreferences['quickActions'][0]>) => {
    setTempPreferences(prev => ({
      ...prev,
      quickActions: prev.quickActions.map(action => 
        action.id === id ? { ...action, ...updates } : action
      )
    }));
  };

  const savePreferences = () => {
    onPreferencesChange(tempPreferences);
    setHasChanges(false);
    toast({
      title: "Preferences Saved",
      description: "Your preferences have been updated successfully",
    });
  };

  const resetPreferences = () => {
    setTempPreferences(DEFAULT_PREFERENCES);
    toast({
      title: "Preferences Reset",
      description: "All preferences have been reset to defaults",
    });
  };

  const discardChanges = () => {
    setTempPreferences(preferences);
    setHasChanges(false);
  };

  const exportPreferences = () => {
    const dataStr = JSON.stringify(tempPreferences, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cashflow-preferences.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Preferences Exported",
      description: "Your preferences have been downloaded as a JSON file",
    });
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light': return <Sun className="h-4 w-4" />;
      case 'dark': return <Moon className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      
      <SheetContent className="w-[600px] max-w-[90vw] glass-card" side="right">
        <SheetHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
              <Settings className="h-6 w-6 text-[#17B6C3]" />
            </div>
            <div>
              <SheetTitle className="text-xl font-semibold" data-testid="title-preferences-panel">
                User Preferences
              </SheetTitle>
              <SheetDescription>
                Customize your cashflow dashboard experience
              </SheetDescription>
            </div>
          </div>
          
          {hasChanges && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-sm text-amber-700 dark:text-amber-300">
                You have unsaved changes
              </span>
            </div>
          )}
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="appearance" className="text-xs" data-testid="tab-appearance">
              <Palette className="h-4 w-4 mr-1" />
              Theme
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs" data-testid="tab-alerts">
              <Bell className="h-4 w-4 mr-1" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="behavior" className="text-xs" data-testid="tab-behavior">
              <Zap className="h-4 w-4 mr-1" />
              Behavior
            </TabsTrigger>
            <TabsTrigger value="layout" className="text-xs" data-testid="tab-layout">
              <Grid3X3 className="h-4 w-4 mr-1" />
              Layout
            </TabsTrigger>
          </TabsList>

          <div className="h-[calc(100vh-300px)] overflow-y-auto pr-2">
            <TabsContent value="appearance" className="space-y-6 mt-0">
              {/* Theme Selection */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Appearance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Theme</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {['light', 'dark', 'system'].map(theme => (
                        <button
                          key={theme}
                          onClick={() => updatePreference('theme', theme)}
                          className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
                            tempPreferences.theme === theme
                              ? 'border-[#17B6C3] bg-[#17B6C3]/10'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                          data-testid={`button-theme-${theme}`}
                        >
                          {getThemeIcon(theme)}
                          <span className="text-xs font-medium capitalize">{theme}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Accent Color</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {ACCENT_COLORS.map(color => (
                        <button
                          key={color.value}
                          onClick={() => updatePreference('accentColor', color.value)}
                          className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-all ${
                            tempPreferences.accentColor === color.value
                              ? 'border-2 scale-105'
                              : 'border-gray-200 dark:border-gray-700 hover:scale-105'
                          }`}
                          style={{ borderColor: tempPreferences.accentColor === color.value ? color.value : undefined }}
                          data-testid={`button-color-${color.name.toLowerCase().replace(' ', '-')}`}
                        >
                          <div 
                            className="w-6 h-6 rounded-full"
                            style={{ backgroundColor: color.value }}
                          />
                          <span className="text-xs text-center">{color.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Reduced Motion</Label>
                        <p className="text-xs text-muted-foreground">Minimize animations and transitions</p>
                      </div>
                      <Switch
                        checked={tempPreferences.reducedMotion}
                        onCheckedChange={(checked) => updatePreference('reducedMotion', checked)}
                        data-testid="switch-reduced-motion"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Compact Mode</Label>
                        <p className="text-xs text-muted-foreground">Reduce spacing and padding</p>
                      </div>
                      <Switch
                        checked={tempPreferences.compactMode}
                        onCheckedChange={(checked) => updatePreference('compactMode', checked)}
                        data-testid="switch-compact-mode"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alerts" className="space-y-6 mt-0">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Alert Thresholds
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      Cash Runway Warning: {tempPreferences.cashRunwayWarning} months
                    </Label>
                    <Slider
                      value={[tempPreferences.cashRunwayWarning]}
                      onValueChange={([value]) => updatePreference('cashRunwayWarning', value)}
                      max={24}
                      min={1}
                      step={1}
                      className="cursor-pointer"
                      data-testid="slider-runway-warning"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Get alerted when cash runway falls below this threshold
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      Overdue Payment Alert: {tempPreferences.overduePaymentAlert} days
                    </Label>
                    <Slider
                      value={[tempPreferences.overduePaymentAlert]}
                      onValueChange={([value]) => updatePreference('overduePaymentAlert', value)}
                      max={90}
                      min={1}
                      step={1}
                      className="cursor-pointer"
                      data-testid="slider-overdue-alert"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Alert when payments are overdue by this many days
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      Collection Target: {tempPreferences.collectionTargetThreshold}%
                    </Label>
                    <Slider
                      value={[tempPreferences.collectionTargetThreshold]}
                      onValueChange={([value]) => updatePreference('collectionTargetThreshold', value)}
                      max={100}
                      min={50}
                      step={5}
                      className="cursor-pointer"
                      data-testid="slider-collection-target"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Alert when collection rate falls below this percentage
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Automation Alerts</Label>
                      <p className="text-xs text-muted-foreground">Get notified about automated actions</p>
                    </div>
                    <Switch
                      checked={tempPreferences.automationAlerts}
                      onCheckedChange={(checked) => updatePreference('automationAlerts', checked)}
                      data-testid="switch-automation-alerts"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="behavior" className="space-y-6 mt-0">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Behavior & Export
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Default Export Format</Label>
                      <Select
                        value={tempPreferences.defaultExportFormat}
                        onValueChange={(value: any) => updatePreference('defaultExportFormat', value)}
                      >
                        <SelectTrigger data-testid="select-export-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                          <SelectItem value="csv">CSV (.csv)</SelectItem>
                          <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-2 block">Default Currency</Label>
                      <Select
                        value={tempPreferences.defaultCurrency}
                        onValueChange={(value) => updatePreference('defaultCurrency', value)}
                      >
                        <SelectTrigger data-testid="select-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="CAD">CAD (C$)</SelectItem>
                          <SelectItem value="AUD">AUD (A$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Default Date Range</Label>
                    <Select
                      value={tempPreferences.defaultDateRange}
                      onValueChange={(value: any) => updatePreference('defaultDateRange', value)}
                    >
                      <SelectTrigger data-testid="select-date-range">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1m">1 Month</SelectItem>
                        <SelectItem value="3m">3 Months</SelectItem>
                        <SelectItem value="6m">6 Months</SelectItem>
                        <SelectItem value="1y">1 Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Include Charts in Exports</Label>
                        <p className="text-xs text-muted-foreground">Add visualizations to exported reports</p>
                      </div>
                      <Switch
                        checked={tempPreferences.includeCharts}
                        onCheckedChange={(checked) => updatePreference('includeCharts', checked)}
                        data-testid="switch-include-charts"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Auto-save Scenarios</Label>
                        <p className="text-xs text-muted-foreground">Automatically save changes to scenarios</p>
                      </div>
                      <Switch
                        checked={tempPreferences.autoSaveScenarios}
                        onCheckedChange={(checked) => updatePreference('autoSaveScenarios', checked)}
                        data-testid="switch-auto-save"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Show Tooltips</Label>
                        <p className="text-xs text-muted-foreground">Display helpful tooltips and hints</p>
                      </div>
                      <Switch
                        checked={tempPreferences.showTooltips}
                        onCheckedChange={(checked) => updatePreference('showTooltips', checked)}
                        data-testid="switch-tooltips"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Keyboard Shortcuts</Label>
                        <p className="text-xs text-muted-foreground">Enable keyboard shortcuts for faster navigation</p>
                      </div>
                      <Switch
                        checked={tempPreferences.enableKeyboardShortcuts}
                        onCheckedChange={(checked) => updatePreference('enableKeyboardShortcuts', checked)}
                        data-testid="switch-keyboard-shortcuts"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="layout" className="space-y-6 mt-0">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layout className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tempPreferences.quickActions.map((action, index) => (
                      <div 
                        key={action.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`quick-action-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Move className="h-4 w-4 text-gray-400 cursor-move" />
                            <Badge variant="outline" className="text-xs">
                              {action.icon}
                            </Badge>
                          </div>
                          <span className="text-sm font-medium">{action.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={action.enabled}
                            onCheckedChange={(checked) => updateQuickAction(action.id, { enabled: checked })}
                            size="sm"
                            data-testid={`switch-action-${action.id}`}
                          />
                          {action.enabled ? (
                            <Eye className="h-4 w-4 text-green-600" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Drag to reorder, toggle to show/hide quick action buttons
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPreferences}
              data-testid="button-export-preferences"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetPreferences}
              data-testid="button-reset-preferences"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={discardChanges}
                data-testid="button-discard-changes"
              >
                Discard
              </Button>
            )}
            <Button
              onClick={savePreferences}
              disabled={!hasChanges}
              size="sm"
              data-testid="button-save-preferences"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}