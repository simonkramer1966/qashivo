import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Shield } from "lucide-react";

export default function DocsDownload() {
  const handleDownloadSecurity = () => {
    // Open in new tab - browser will handle download
    window.open('/api/docs/security/download', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Documentation Downloads</h1>
          <p className="text-gray-600">Download platform documentation in PDF format</p>
        </div>

        <div className="grid gap-6">
          {/* Security Documentation Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#17B6C3]/10 rounded-lg">
                  <Shield className="w-8 h-8 text-[#17B6C3]" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">Security Documentation</CardTitle>
                  <CardDescription className="mt-2">
                    Comprehensive security architecture guide covering authentication, authorization, RBAC, tenant isolation, and improvement recommendations.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">What's Included:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#17B6C3]" />
                      Authentication & Session Management
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#17B6C3]" />
                      50+ RBAC Permissions & Role Hierarchy
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#17B6C3]" />
                      Multi-Tenant Isolation Strategy
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#17B6C3]" />
                      Partner B2B2B Architecture
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#17B6C3]" />
                      Platform Admin Security
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#17B6C3]" />
                      Security Improvements Roadmap
                    </li>
                  </ul>
                </div>

                <Button 
                  onClick={handleDownloadSecurity}
                  className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg py-6"
                  data-testid="button-download-security-pdf"
                >
                  <Download className="mr-2 w-5 h-5" />
                  Download Security Documentation (PDF)
                </Button>

                <p className="text-sm text-gray-500 text-center">
                  File name: Qashivo-Security-Documentation.pdf
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Future Documentation Cards */}
          <Card className="bg-white/60 backdrop-blur-sm border-white/50 opacity-60">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gray-200 rounded-lg">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl text-gray-500">Additional Documentation</CardTitle>
                  <CardDescription className="mt-2">
                    More documentation downloads coming soon...
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
