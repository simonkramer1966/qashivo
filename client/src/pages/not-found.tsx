import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen page-gradient flex items-center justify-center p-6">
      <Card className="card-glass max-w-md w-full" data-testid="card-notfound">
        <CardContent className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900" data-testid="text-error-code">404</h1>
            <h2 className="text-xl font-semibold text-gray-800" data-testid="text-error-title">Page Not Found</h2>
            <p className="text-gray-600" data-testid="text-error-message">
              Sorry, the page you are looking for doesn't exist or has been moved.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              asChild 
              className="btn-primary flex-1" 
              data-testid="button-home"
            >
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Link>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.history.back()} 
              className="btn-secondary flex-1" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
