import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Copy, Plus } from "lucide-react";

export default function WorkflowTemplates() {
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["/api/workflows"],
    retry: false,
  });

  // Mock workflow templates for demonstration
  const mockTemplates = [
    {
      id: "1",
      name: "Standard Collection",
      description: "Automated email sequence with escalating urgency over 30 days",
      successRate: "78%",
      steps: [
        { day: 1, action: "Friendly reminder email" },
        { day: 7, action: "Follow-up email" },
        { day: 15, action: "Phone call reminder" },
        { day: 30, action: "Final notice" },
      ]
    },
    {
      id: "2",
      name: "High Value",
      description: "Personal approach for invoices over $10,000 with direct calls",
      successRate: "92%",
      steps: [
        { day: 1, action: "Personal email" },
        { day: 3, action: "Phone call" },
        { day: 10, action: "Manager call" },
      ]
    },
    {
      id: "3",
      name: "Gentle Reminder",
      description: "Soft approach for long-term clients with relationship focus",
      successRate: "85%",
      steps: [
        { day: 5, action: "Courtesy email" },
        { day: 14, action: "Friendly check-in" },
        { day: 21, action: "Payment plan offer" },
      ]
    },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle data-testid="text-workflow-templates-title">Collection Workflow Templates</CardTitle>
          <Button data-testid="button-create-workflow">
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mockTemplates.map((template) => (
            <div 
              key={template.id} 
              className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
              data-testid={`card-workflow-template-${template.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground" data-testid={`text-template-name-${template.id}`}>
                  {template.name}
                </h4>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm" data-testid={`button-edit-workflow-${template.id}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" data-testid={`button-duplicate-workflow-${template.id}`}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4" data-testid={`text-template-description-${template.id}`}>
                {template.description}
              </p>
              <div className="space-y-2">
                {template.steps.map((step, index) => (
                  <div key={index} className="flex items-center text-xs">
                    <div className="workflow-step w-6 h-6 rounded-full text-white flex items-center justify-center mr-2">
                      {index + 1}
                    </div>
                    <span className="text-muted-foreground" data-testid={`text-step-${template.id}-${index}`}>
                      Day {step.day}: {step.action}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span data-testid={`text-success-rate-${template.id}`}>
                    Success Rate: {template.successRate}
                  </span>
                  <Button 
                    size="sm" 
                    className="text-xs hover:bg-primary/90" 
                    data-testid={`button-activate-workflow-${template.id}`}
                  >
                    Activate
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
