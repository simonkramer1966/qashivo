import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  User, 
  Building2, 
  FileText, 
  CreditCard, 
  Calendar, 
  Clock,
  AlertCircle,
  Copy,
  Eye
} from "lucide-react";

interface TemplateVariable {
  name: string;
  description: string;
  example: string;
  icon: any;
}

const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    name: "{firstName}",
    description: "Contact's first name",
    example: "David",
    icon: User,
  },
  {
    name: "{lastName}",
    description: "Contact's last name",
    example: "Richardson",
    icon: User,
  },
  {
    name: "{customerName}",
    description: "Full name or company",
    example: "David Richardson",
    icon: User,
  },
  {
    name: "{companyName}",
    description: "Company name",
    example: "Tech Startups Ltd",
    icon: Building2,
  },
  {
    name: "{invoiceNumber}",
    description: "Invoice reference number",
    example: "INV-2024-001",
    icon: FileText,
  },
  {
    name: "{amount}",
    description: "Invoice amount",
    example: "£1,250.00",
    icon: CreditCard,
  },
  {
    name: "{dueDate}",
    description: "Payment due date",
    example: "15/01/2025",
    icon: Calendar,
  },
  {
    name: "{daysOverdue}",
    description: "Days past due",
    example: "7",
    icon: Clock,
  },
];

interface TemplateVariableHelperProps {
  value: string;
  onChange?: (value: string) => void;
  onInsertVariable?: (variable: string) => void;
  showPreview?: boolean;
}

export function TemplateVariableHelper({ 
  value, 
  onChange,
  onInsertVariable,
  showPreview = true 
}: TemplateVariableHelperProps) {
  const [showValidation, setShowValidation] = useState(true);

  // Detect invalid variable usage
  const detectInvalidVariables = (text: string): string[] => {
    const validVars = TEMPLATE_VARIABLES.map(v => v.name);
    const pattern = /\{([^}]+)\}/g;
    const found: string[] = [];
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = `{${match[1]}}`;
      if (!validVars.includes(fullMatch)) {
        found.push(fullMatch);
      }
    }
    
    return found;
  };

  const invalidVars = detectInvalidVariables(value);
  
  // Generate preview with example data
  const generatePreview = (text: string): string => {
    let preview = text;
    TEMPLATE_VARIABLES.forEach(variable => {
      preview = preview.replace(new RegExp(variable.name.replace(/[{}]/g, '\\$&'), 'g'), variable.example);
    });
    return preview;
  };

  const preview = generatePreview(value);

  const handleInsertVariable = (variableName: string) => {
    if (onInsertVariable) {
      onInsertVariable(variableName);
    }
  };

  return (
    <div className="space-y-4">
      {/* Variable Reference */}
      <Card className="bg-slate-50/50 border-slate-200">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Copy className="h-4 w-4 text-slate-600" />
            <h4 className="text-sm font-semibold text-slate-900">Available Variables</h4>
            <Badge variant="secondary" className="ml-auto">
              {TEMPLATE_VARIABLES.length} variables
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATE_VARIABLES.map((variable) => {
              const Icon = variable.icon;
              return (
                <Button
                  key={variable.name}
                  variant="outline"
                  size="sm"
                  className="justify-start h-auto py-2 px-3 bg-white hover:bg-[#17B6C3]/5 hover:border-[#17B6C3] transition-colors"
                  onClick={() => handleInsertVariable(variable.name)}
                  data-testid={`button-insert-${variable.name.replace(/[{}]/g, '')}`}
                >
                  <div className="flex items-start gap-2 w-full">
                    <Icon className="h-3.5 w-3.5 text-[#17B6C3] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-mono text-xs text-slate-900 font-semibold">
                        {variable.name}
                      </div>
                      <div className="text-xs text-slate-600 truncate">
                        {variable.description}
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-600">
              Click any variable to insert it at the cursor position in your template.
            </p>
          </div>
        </div>
      </Card>

      {/* Validation Warnings */}
      {showValidation && invalidVars.length > 0 && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="text-sm">
              <strong>Invalid variables detected:</strong>
              <div className="mt-1 flex flex-wrap gap-1">
                {invalidVars.map((v, i) => (
                  <Badge key={i} variant="destructive" className="font-mono text-xs">
                    {v}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-xs">
                These variables won't be replaced. Please use the variables listed above.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Live Preview */}
      {showPreview && value && (
        <Card className="bg-blue-50/50 border-blue-200">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-blue-900">Preview</h4>
              <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-800">
                Example Data
              </Badge>
            </div>
            
            <div className="bg-white rounded-md p-3 border border-blue-200">
              <p className="text-sm text-slate-900 whitespace-pre-wrap" data-testid="text-template-preview">
                {preview}
              </p>
            </div>
            
            <div className="mt-2 flex items-center justify-between text-xs text-blue-700">
              <span>{preview.length} characters</span>
              <span>{Math.ceil(preview.length / 160)} SMS segment{Math.ceil(preview.length / 160) !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
