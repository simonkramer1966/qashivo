import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  CreditCard,
  Building2,
  ArrowRightLeft,
  TestTube,
  Zap,
  Activity,
  Target,
  Shield,
  Globe,
  Settings
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ProviderTestResult {
  provider: string;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  tests: {
    connection: boolean;
    dataRetrieval: boolean;
    dataTransformation: boolean;
    unifiedDisplay: boolean;
    errorHandling: boolean;
    authentication: boolean;
  };
  metrics: {
    responseTime: number;
    recordsProcessed: number;
    transformationAccuracy: number;
    errorRate: number;
  };
  capabilities: string[];
  limitations: string[];
  lastTested: string;
}

interface DataConsistencyReport {
  dataType: string;
  providers: {
    [key: string]: {
      recordCount: number;
      averageProcessingTime: number;
      fieldCoverage: number;
      dataQuality: number;
      schemaCompliance: number;
    };
  };
  unifiedModelCompliance: number;
  inconsistencies: Array<{
    field: string;
    providers: string[];
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

interface ProviderSwitchingTest {
  scenario: string;
  fromProvider: string;
  toProvider: string;
  status: 'passed' | 'failed' | 'partial';
  dataIntegrity: number;
  performanceImpact: number;
  issues: string[];
}

export default function MultiProviderTesting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [testingInProgress, setTestingInProgress] = useState(false);
  const [selectedTestType, setSelectedTestType] = useState('all');

  // Fetch provider test results
  const { data: providerResults } = useQuery<ProviderTestResult[]>({
    queryKey: ['/api/testing/providers'],
    refetchInterval: testingInProgress ? 5000 : 30000,
  });

  // Fetch data consistency reports
  const { data: consistencyReports } = useQuery<DataConsistencyReport[]>({
    queryKey: ['/api/testing/data-consistency'],
  });

  // Fetch provider switching tests
  const { data: switchingTests } = useQuery<ProviderSwitchingTest[]>({
    queryKey: ['/api/testing/provider-switching'],
  });

  // Run comprehensive tests mutation
  const runTestsMutation = useMutation({
    mutationFn: async (testConfig: { 
      providers: string[]; 
      testTypes: string[];
      includeStressTest: boolean;
    }) => {
      return await apiRequest('/api/testing/run-comprehensive', {
        method: 'POST',
        body: JSON.stringify(testConfig),
      });
    },
    onSuccess: () => {
      setTestingInProgress(true);
      toast({
        title: "Testing Started",
        description: "Comprehensive multi-provider testing initiated",
        variant: "default",
      });
      
      // Refresh test results
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/testing/providers'] });
        queryClient.invalidateQueries({ queryKey: ['/api/testing/data-consistency'] });
        setTestingInProgress(false);
      }, 30000); // 30 second test duration
    },
    onError: (error) => {
      toast({
        title: "Testing Failed",
        description: `Failed to start tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setTestingInProgress(false);
    },
  });

  const providers = [
    { 
      id: 'xero', 
      name: 'Xero', 
      icon: BarChart3, 
      color: '#17B6C3',
      expectedCapabilities: ['Invoices', 'Bills', 'Contacts', 'Bank Transactions', 'Reports', 'Webhooks']
    },
    { 
      id: 'sage', 
      name: 'Sage', 
      icon: Database, 
      color: '#10b981',
      expectedCapabilities: ['Invoices', 'Bills', 'Contacts', 'Bank Accounts', 'Journals']
    },
    { 
      id: 'quickbooks', 
      name: 'QuickBooks', 
      icon: TrendingUp, 
      color: '#3b82f6',
      expectedCapabilities: ['Invoices', 'Bills', 'Customers', 'Vendors', 'Payments', 'Reports']
    }
  ];

  const dataTypes = [
    { id: 'contacts', name: 'Contacts/Customers', icon: Users, critical: true },
    { id: 'invoices', name: 'Invoices', icon: FileText, critical: true },
    { id: 'bills', name: 'Bills', icon: CreditCard, critical: true },
    { id: 'payments', name: 'Payments', icon: ArrowRightLeft, critical: true },
    { id: 'bank-accounts', name: 'Bank Accounts', icon: Building2, critical: false },
    { id: 'bank-transactions', name: 'Bank Transactions', icon: Activity, critical: false },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-700 bg-green-50 border-green-200';
      case 'failed': return 'text-red-700 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'pending': return 'text-gray-700 bg-gray-50 border-gray-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="h-4 w-4" />;
      case 'failed': return <AlertTriangle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'pending': return <RefreshCw className="h-4 w-4 animate-spin" />;
      default: return <RefreshCw className="h-4 w-4" />;
    }
  };

  const calculateOverallScore = (result: ProviderTestResult) => {
    const testScores = Object.values(result.tests).map(test => test ? 100 : 0);
    const avgTestScore = testScores.reduce((a, b) => a + b, 0) / testScores.length;
    
    const metricsScore = (
      (result.metrics.transformationAccuracy) +
      (100 - result.metrics.errorRate) +
      (Math.min(100, 1000 / result.metrics.responseTime)) // Inverse response time score
    ) / 3;
    
    return Math.round((avgTestScore + metricsScore) / 2);
  };

  return (
    <div className="space-y-6">
      <Card className="card-glass">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5 text-[#17B6C3]" />
                Multi-Provider Integration Testing
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Comprehensive validation of provider-agnostic data consolidation across accounting platforms
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={selectedTestType} onValueChange={setSelectedTestType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Test type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tests</SelectItem>
                  <SelectItem value="connection">Connection Tests</SelectItem>
                  <SelectItem value="data">Data Tests</SelectItem>
                  <SelectItem value="switching">Provider Switching</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                onClick={() => runTestsMutation.mutate({
                  providers: providers.map(p => p.id),
                  testTypes: selectedTestType === 'all' ? ['connection', 'data', 'switching', 'performance'] : [selectedTestType],
                  includeStressTest: true
                })}
                disabled={testingInProgress || runTestsMutation.isPending}
                data-testid="button-run-tests"
              >
                {testingInProgress ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Run Tests
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Test Overview</TabsTrigger>
              <TabsTrigger value="data-consistency">Data Consistency</TabsTrigger>
              <TabsTrigger value="provider-switching">Provider Switching</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            {/* Test Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {providers.map((provider) => {
                  const providerResult = providerResults?.find(r => r.provider === provider.id);
                  const overallScore = providerResult ? calculateOverallScore(providerResult) : 0;
                  const statusColor = getStatusColor(providerResult?.status || 'pending');

                  return (
                    <div key={provider.id} className="space-y-4">
                      {/* Provider Header */}
                      <div className={`p-4 rounded-lg border ${statusColor}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <provider.icon className="h-8 w-8" style={{ color: provider.color }} />
                            <div>
                              <h3 className="font-semibold">{provider.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusIcon(providerResult?.status || 'pending')}
                                <span className="text-sm font-medium">
                                  Score: {overallScore}%
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">
                              {providerResult?.metrics.recordsProcessed || 0} records
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {providerResult?.metrics.responseTime || 0}ms avg
                            </div>
                          </div>
                        </div>
                        
                        <Progress value={overallScore} className="h-2 mb-2" />
                      </div>

                      {/* Test Details */}
                      {providerResult && (
                        <div className="p-4 bg-white border rounded-lg space-y-3">
                          <h4 className="font-medium text-sm">Test Results</h4>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(providerResult.tests).map(([test, passed]) => (
                              <div key={test} className="flex items-center gap-2">
                                {passed ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3 text-red-600" />
                                )}
                                <span className="capitalize">
                                  {test.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          {/* Capabilities */}
                          <div>
                            <h5 className="font-medium text-xs text-muted-foreground mb-2">Capabilities</h5>
                            <div className="flex flex-wrap gap-1">
                              {providerResult.capabilities.map((cap) => (
                                <Badge key={cap} variant="outline" className="text-xs px-1 py-0">
                                  {cap}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          {/* Limitations */}
                          {providerResult.limitations.length > 0 && (
                            <div>
                              <h5 className="font-medium text-xs text-muted-foreground mb-2">Limitations</h5>
                              <div className="space-y-1">
                                {providerResult.limitations.map((limitation, i) => (
                                  <div key={i} className="text-xs text-orange-600 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {limitation}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Data Consistency Tab */}
            <TabsContent value="data-consistency" className="space-y-6 mt-6">
              {consistencyReports && (
                <div className="space-y-4">
                  {dataTypes.map((dataType) => {
                    const report = consistencyReports.find(r => r.dataType === dataType.id);
                    
                    return (
                      <div key={dataType.id} className="p-4 border rounded-lg bg-white">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <dataType.icon className="h-6 w-6 text-[#17B6C3]" />
                            <div>
                              <h4 className="font-semibold">{dataType.name}</h4>
                              {dataType.critical && (
                                <Badge variant="outline" className="text-xs mt-1">Critical Data Type</Badge>
                              )}
                            </div>
                          </div>
                          
                          {report && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                Unified Model Compliance: {report.unifiedModelCompliance}%
                              </span>
                              <Progress value={report.unifiedModelCompliance} className="w-24 h-2" />
                            </div>
                          )}
                        </div>
                        
                        {report && (
                          <>
                            {/* Provider Comparison */}
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              {Object.entries(report.providers).map(([provider, metrics]) => (
                                <div key={provider} className="p-3 bg-gray-50 rounded">
                                  <div className="font-medium text-sm capitalize">{provider}</div>
                                  <div className="space-y-1 text-xs text-muted-foreground mt-2">
                                    <div>Records: {metrics.recordCount.toLocaleString()}</div>
                                    <div>Processing: {metrics.averageProcessingTime}ms</div>
                                    <div>Field Coverage: {metrics.fieldCoverage}%</div>
                                    <div>Data Quality: {metrics.dataQuality}%</div>
                                    <div>Schema Compliance: {metrics.schemaCompliance}%</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Inconsistencies */}
                            {report.inconsistencies.length > 0 && (
                              <div>
                                <h5 className="font-medium text-sm mb-2">Data Inconsistencies</h5>
                                <div className="space-y-2">
                                  {report.inconsistencies.map((issue, i) => (
                                    <div 
                                      key={i}
                                      className={`p-2 rounded text-xs ${
                                        issue.severity === 'high' ? 'bg-red-50 text-red-800' :
                                        issue.severity === 'medium' ? 'bg-yellow-50 text-yellow-800' :
                                        'bg-blue-50 text-blue-800'
                                      }`}
                                    >
                                      <div className="font-medium">{issue.field} - {issue.providers.join(', ')}</div>
                                      <div>{issue.issue}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Provider Switching Tab */}
            <TabsContent value="provider-switching" className="space-y-6 mt-6">
              {switchingTests && (
                <div className="space-y-4">
                  {switchingTests.map((test, i) => (
                    <div key={i} className="p-4 border rounded-lg bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-semibold">{test.scenario}</h4>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span className="capitalize">{test.fromProvider}</span>
                            <ArrowRightLeft className="h-4 w-4" />
                            <span className="capitalize">{test.toProvider}</span>
                          </div>
                        </div>
                        
                        <Badge 
                          variant="outline" 
                          className={getStatusColor(test.status)}
                        >
                          {test.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-sm font-medium">Data Integrity</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={test.dataIntegrity} className="flex-1 h-2" />
                            <span className="text-sm">{test.dataIntegrity}%</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">Performance Impact</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress 
                              value={100 - test.performanceImpact} 
                              className="flex-1 h-2" 
                            />
                            <span className="text-sm">{test.performanceImpact}% impact</span>
                          </div>
                        </div>
                      </div>
                      
                      {test.issues.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-red-700 mb-2">Issues Found</div>
                          <div className="space-y-1">
                            {test.issues.map((issue, j) => (
                              <div key={j} className="text-xs text-red-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {issue}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Response Time Comparison */}
                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#17B6C3]" />
                    Response Time Performance
                  </h4>
                  
                  {providerResults && (
                    <div className="space-y-3">
                      {providerResults.map((result) => (
                        <div key={result.provider} className="flex items-center justify-between">
                          <span className="capitalize text-sm">{result.provider}</span>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={Math.min(100, 1000 / result.metrics.responseTime)} 
                              className="w-20 h-2" 
                            />
                            <span className="text-sm w-16 text-right">
                              {result.metrics.responseTime}ms
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Data Processing Efficiency */}
                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-[#17B6C3]" />
                    Processing Efficiency
                  </h4>
                  
                  {providerResults && (
                    <div className="space-y-3">
                      {providerResults.map((result) => (
                        <div key={result.provider} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{result.provider}</span>
                            <span>{result.metrics.recordsProcessed} records</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>Accuracy: {result.metrics.transformationAccuracy}%</div>
                            <div>Error Rate: {result.metrics.errorRate}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}