import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  ExternalLink, 
  Database, 
  Download, 
  Loader2,
  AlertCircle,
  Users,
  FileText,
  CreditCard
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
  const { toast } = useToast();
  
  const techData = phaseData.technical_connection || {};
  const isXeroConnected = techData.xeroConnected || false;
  const isDataImported = techData.dataImported || false;
  const recordsImported = techData.recordsImported || { contacts: 0, invoices: 0, payments: 0 };

  const handleXeroConnect = () => {
    // In a real implementation, this would redirect to Xero OAuth
    window.open('/api/xero/auth', '_blank');
    
    // Simulate connection progress
    setTimeout(() => {
      onUpdate({
        technical_connection: {
          ...techData,
          xeroConnected: true
        }
      });
      setConnectionStep(1);
      toast({
        title: "Xero Connected!",
        description: "Successfully connected to your Xero account."
      });
    }, 2000);
  };

  const handleDataImport = () => {
    setConnectionStep(2);
    
    // Simulate data import progress
    setTimeout(() => {
      onUpdate({
        technical_connection: {
          ...techData,
          xeroConnected: true,
          dataImported: true,
          recordsImported: {
            contacts: 42,
            invoices: 156,
            payments: 89
          }
        }
      });
      toast({
        title: "Data Import Complete!",
        description: "Your Xero data has been successfully imported."
      });
    }, 3000);
  };

  const canComplete = isXeroConnected && isDataImported;

  return (
    <div className="space-y-6" data-testid="technical-connection-phase">
      {/* Phase Overview */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Connect Your Accounting System</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          We'll connect to your Xero account and import your existing customer and invoice data. 
          This process is secure and typically takes less than 2 minutes.
        </p>
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

        {/* Step 2: Data Import */}
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
                isXeroConnected ? 'bg-green-500' : 'bg-gray-400'
              }`}>
                <Download className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Import Your Data</CardTitle>
                <CardDescription>
                  Download customers, invoices, and payment history
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
                Connect to Xero first to enable data import
              </p>
            ) : !isDataImported ? (
              <div className="space-y-4">
                {connectionStep === 2 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#17B6C3]" />
                      <span className="text-sm">Importing your data...</span>
                    </div>
                    <Progress value={75} className="h-2" />
                    <p className="text-xs text-gray-500">
                      This may take a few moments depending on your data size
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      Import your existing customer and invoice data to get started immediately.
                    </p>
                    <Button 
                      onClick={handleDataImport}
                      disabled={connectionStep > 0}
                      className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                      data-testid="button-import-data"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Import Data
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-700">Data import completed</span>
                </div>
                
                {/* Import Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-white/50 rounded-lg">
                    <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                    <div className="text-lg font-bold text-blue-600">
                      {recordsImported.contacts}
                    </div>
                    <div className="text-xs text-gray-600">Contacts</div>
                  </div>
                  <div className="text-center p-3 bg-white/50 rounded-lg">
                    <FileText className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <div className="text-lg font-bold text-green-600">
                      {recordsImported.invoices}
                    </div>
                    <div className="text-xs text-gray-600">Invoices</div>
                  </div>
                  <div className="text-center p-3 bg-white/50 rounded-lg">
                    <CreditCard className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                    <div className="text-lg font-bold text-purple-600">
                      {recordsImported.payments}
                    </div>
                    <div className="text-xs text-gray-600">Payments</div>
                  </div>
                </div>
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