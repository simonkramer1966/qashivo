import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, DollarSign, TrendingUp, Zap } from "lucide-react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="flex justify-center items-center mb-6">
              <div className="w-32 h-32 bg-primary rounded-lg flex items-center justify-center p-4">
                <img src={nexusLogo} alt="Nexus AR" className="w-full h-full object-contain" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Nexus AR
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4">
              AI-Driven Accounts Receivable & Debt Recovery
            </p>
            <p className="text-lg text-muted-foreground mb-8 max-w-3xl mx-auto">
              Streamline your collection process with intelligent automation, 
              multi-channel communication, and data-driven insights. 
              Reduce days sales outstanding and improve cash flow.
            </p>
            <Button 
              onClick={handleLogin}
              size="lg"
              className="text-lg px-8 py-3 bg-[#13B5EA] hover:bg-[#1089C3] text-white"
              data-testid="button-login"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to collect faster
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our comprehensive platform integrates with your existing systems 
              and automates your entire collection workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>AI-Powered Suggestions</CardTitle>
                <CardDescription>
                  Get intelligent recommendations on the best collection strategies 
                  for each customer based on payment history and behavior patterns.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Multi-Channel Communication</CardTitle>
                <CardDescription>
                  Reach customers through email, SMS, and phone calls with 
                  automated workflows that escalate appropriately.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Xero Integration</CardTitle>
                <CardDescription>
                  Seamlessly sync with Xero for real-time invoice data, 
                  contact information, and payment status updates.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      {/* Integration Logos */}
      <div className="py-16 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-semibold text-foreground mb-4">
              Integrated with the tools you already use
            </h3>
            <p className="text-muted-foreground">
              Nexus AR connects with your existing business systems
            </p>
          </div>
          
          <div className="flex justify-center items-center space-x-12 opacity-60">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">X</span>
              </div>
              <span className="text-lg font-semibold">Xero</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">SG</span>
              </div>
              <span className="text-lg font-semibold">SendGrid</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">AI</span>
              </div>
              <span className="text-lg font-semibold">OpenAI</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">T</span>
              </div>
              <span className="text-lg font-semibold">Twilio</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
            Ready to transform your collections?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8">
            Join thousands of businesses already using Nexus AR to improve their cash flow.
          </p>
          <Button 
            onClick={handleLogin}
            size="lg"
            className="text-lg px-8 py-3 bg-[#13B5EA] hover:bg-[#1089C3] text-white"
            data-testid="button-login-cta"
          >
            Start Free Trial
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 bg-card border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 Nexus AR. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
