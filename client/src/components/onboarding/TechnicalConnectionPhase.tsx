import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  CheckCircle2, 
  ExternalLink, 
  Database, 
  Download, 
  Loader2,
  AlertCircle,
  Users,
  FileText,
  CreditCard,
  Brain,
  TrendingUp
} from "lucide-react";

interface TechnicalConnectionPhaseProps {
  onComplete: () => void;
  onUpdate: (data: any) => void;
  isCompleting: boolean;
  phaseData: any;
}

export function TechnicalConnectionPhase({ 
  onComplete, 
  onUpdate, 
  isCompleting, 
  phaseData 
}: TechnicalConnectionPhaseProps) {
  const [connectionStep, setConnectionStep] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const { toast } = useToast();
  
  const techData = phaseData.technical_connection || {};
  const isXeroConnected = techData.xeroConnected || false;
  const isDataImported = techData.xeroImportCompleted || false;
  const importSummary = techData.importSummary;
  
  // Xero automated import mutation
  const xeroImportMutation = useMutation({
    mutationFn: () => apiRequest('/api/onboarding/xero-import', { method: 'POST' }),
    onSuccess: (data) => {
      if (data.success) {
        onUpdate({
          technical_connection: {
            ...techData,
            xeroImportCompleted: true,
            importSummary: data.summary,
            importTimestamp: new Date().toISOString()
          }
        });
        toast({
          title: "AI-Powered Import Complete! 🤖",
          description: `Imported ${data.summary.contacts.total} contacts and ${data.summary.invoices.total} invoices with AI insights.`
        });
      } else {
        toast({
          title: "Import completed with issues",
          description: `Some data imported, but there were ${data.errors.length} errors.`,
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      console.error('Xero import failed:', error);
      if (error.requiresAuth) {
        toast({
          title: "Xero Connection Required",
          description: "Please connect your Xero account first.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Import Failed",
          description: error.message || "Failed to import data from Xero.",
          variant: "destructive"
        });
      }
    }
  });

  const handleXeroConnect = () => {
    // Redirect to Xero OAuth
    window.open('/api/xero/auth-url', '_blank');
    
    // Poll for OAuth completion every 2 seconds
    const checkConnection = setInterval(async () => {
      try {
        // Check if user has Xero tokens by calling the tenant endpoint
        const response = await fetch('/api/tenant');
        const tenant = await response.json();
        
        // Check if tenant has Xero connection info
        if (tenant?.xeroConnected || tenant?.hasXeroTokens) {
          onUpdate({
            technical_connection: {
              ...techData,
              xeroConnected: true
            }
          });
          setConnectionStep(1);
          clearInterval(checkConnection);
          toast({
            title: "Xero Connected! ✅",
            description: "Successfully connected to your Xero account."
          });
        }
      } catch (error) {
        console.error('Error checking Xero connection status:', error);
      }
    }, 2000);
    
    // Clear interval after 60 seconds if not connected
    setTimeout(() => {
      clearInterval(checkConnection);
      // Could show a timeout message here
    }, 60000);
  };

  const handleAutomatedImport = () => {
    setConnectionStep(2);
    setImportProgress(0);
    
    // Start progress animation that matches the actual import progress
    const progressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 85 || xeroImportMutation.isSuccess) {
          clearInterval(progressInterval);
          return xeroImportMutation.isSuccess ? 100 : 85;
        }
        return prev + 8;
      });
    }, 400);
    
    // Clear progress interval when mutation completes
    if (xeroImportMutation.isSuccess || xeroImportMutation.isError) {
      clearInterval(progressInterval);
      setImportProgress(100);
    }
    
    // Perform actual import
    xeroImportMutation.mutate();
  };

  const canComplete = isXeroConnected && isDataImported;

  return (
    <div className="space-y-6" data-testid="technical-connection-phase">
      {/* Phase Overview */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">AI-Powered Xero Integration</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Connect your Xero account for intelligent data import with automatic AI profile generation. 
          Our system analyzes your data to create personalized collection strategies.
        </p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Brain className="w-5 h-5 text-[#17B6C3]" />
          <span className="text-sm font-medium text-[#17B6C3]">
            Powered by AI Business Intelligence
          </span>
        </div>
      </div>

      {/* Connection Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Step 1: Xero Connection */}
        <Card className={`transition-all duration-300 ${
          isXeroConnected 
            ? 'bg-green-50 border-green-200' 
            : 'bg-white/70 backdrop-blur-md border-gray-200 hover:shadow-lg'
        }`}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 text-white rounded-lg">
                <ExternalLink className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Connect to Xero</CardTitle>
                <CardDescription>
                  Authorize secure access to your accounting data
                </CardDescription>
              </div>
              {isXeroConnected && (
                <CheckCircle2 className="w-6 h-6 text-green-500 ml-auto" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!isXeroConnected ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Click below to securely connect your Xero account. We only request read-only access 
                  to your customer and invoice data.
                </p>
                <Button 
                  onClick={handleXeroConnect}
                  className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-connect-xero"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect to Xero
                </Button>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <AlertCircle className="w-3 h-3" />
                  <span>We use bank-level security and never store your login credentials</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-700">Successfully connected to Xero</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  Connected
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: AI-Powered Data Import */}
        <Card className={`transition-all duration-300 ${
          isDataImported 
            ? 'bg-green-50 border-green-200' 
            : isXeroConnected 
            ? 'bg-white/70 backdrop-blur-md border-gray-200 hover:shadow-lg'
            : 'bg-gray-50 border-gray-200 opacity-60'
        }`}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg text-white ${
                isXeroConnected ? 'bg-[#17B6C3]' : 'bg-gray-400'
              }`}>
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Data Import & Analysis</CardTitle>
                <CardDescription>
                  Smart import with automatic AI profile generation
                </CardDescription>
              </div>
              {isDataImported && (
                <CheckCircle2 className="w-6 h-6 text-green-500 ml-auto" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!isXeroConnected ? (
              <p className="text-sm text-gray-500">
                Connect to Xero first to enable AI-powered import
              </p>
            ) : !isDataImported ? (
              <div className="space-y-4">
                {connectionStep === 2 || xeroImportMutation.isPending ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#17B6C3]" />
                      <span className="text-sm">
                        {importProgress < 30 ? "Connecting to Xero..." :
                         importProgress < 60 ? "Importing contacts and invoices..." :
                         importProgress < 85 ? "Analyzing payment patterns..." :
                         "Generating AI collection profiles..."}
                      </span>
                    </div>
                    <Progress value={xeroImportMutation.isSuccess ? 100 : importProgress} className="h-2" />
                    <div className="text-xs text-gray-500 space-y-1">
                      <p className={importProgress >= 30 ? "text-green-600" : ""}>
                        • {importProgress >= 30 ? "✓" : "•"} Importing contacts and invoices
                      </p>
                      <p className={importProgress >= 60 ? "text-green-600" : ""}>
                        • {importProgress >= 60 ? "✓" : "•"} Analyzing payment patterns
                      </p>
                      <p className={importProgress >= 85 ? "text-green-600" : ""}>
                        • {importProgress >= 85 ? "✓" : "•"} Generating AI collection profiles
                      </p>
                    </div>
                    {xeroImportMutation.isError && (
                      <div className="text-xs text-red-600">
                        Import failed. Please try again or check your Xero connection.
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Our AI will import your data and automatically generate intelligent collection strategies based on your business patterns.
                      </p>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                          <Brain className="w-4 h-4 text-blue-500 mt-0.5" />
                          <div className="text-xs text-blue-700">
                            <strong>AI Features:</strong>
                            <ul className="mt-1 space-y-1">
                              <li>• Payment behavior analysis</li>
                              <li>• Risk assessment</li>
                              <li>• Optimal collection timing</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={handleAutomatedImport}
                      disabled={connectionStep > 0 || xeroImportMutation.isPending}
                      className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                      data-testid="button-import-data"
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      Start AI Import & Analysis
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-700">AI analysis completed</span>
                </div>
                
                {/* Enhanced Import Summary with AI Insights */}
                {importSummary && (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="text-center p-3 bg-white/50 rounded-lg">
                        <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                        <div className="text-lg font-bold text-blue-600">
                          {importSummary.contacts.total}
                        </div>
                        <div className="text-xs text-gray-600">Contacts</div>
                      </div>
                      <div className="text-center p-3 bg-white/50 rounded-lg">
                        <FileText className="w-5 h-5 mx-auto mb-1 text-green-500" />
                        <div className="text-lg font-bold text-green-600">
                          {importSummary.invoices.total}
                        </div>
                        <div className="text-xs text-gray-600">Invoices</div>
                      </div>
                    </div>
                    
                    {/* AI Insights */}
                    <div className="bg-gradient-to-r from-[#17B6C3]/10 to-blue-50 p-4 rounded-lg border border-[#17B6C3]/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-[#17B6C3]" />
                        <span className="text-sm font-semibold text-[#17B6C3]">AI Business Intelligence</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span>Business Size:</span>
                          <Badge variant="secondary" className="text-xs">
                            {importSummary.insights.businessSize}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Risk Level:</span>
                          <Badge variant={
                            importSummary.insights.riskLevel === 'low' ? 'default' :
                            importSummary.insights.riskLevel === 'medium' ? 'secondary' : 'destructive'
                          } className="text-xs">
                            {importSummary.insights.riskLevel}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Payment Days:</span>
                          <span className="font-medium">{importSummary.invoices.avgDaysToPayment} days</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Completion Summary */}
      {canComplete && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500 text-white rounded-lg">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">
                  Technical Connection Complete!
                </h3>
                <p className="text-green-700 text-sm">
                  Your Xero account is connected and data has been imported successfully. 
                  You're ready to move to business setup.
                </p>
              </div>
              <Button 
                onClick={onComplete}
                disabled={isCompleting}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-complete-technical-phase"
              >
                {isCompleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Complete Phase
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}