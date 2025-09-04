import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Copy, Plus, Workflow, Clock, CheckCircle2 } from "lucide-react";

export default function WorkflowTemplates() {
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["/api/workflows"],
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
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold flex items-center" data-testid="text-workflow-templates-title">
            <div className="p-3 bg-[#17B6C3]/10 rounded-xl mr-4">
              <Workflow className="h-6 w-6 text-[#17B6C3]" />
            </div>
            Collection Workflow Templates
          </CardTitle>
          <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-create-workflow">
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {mockTemplates.map((template) => (
            <div 
              key={template.id} 
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              data-testid={`card-workflow-template-${template.id}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-lg text-slate-900" data-testid={`text-template-name-${template.id}`}>
                  {template.name}
                </h4>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                    data-testid={`button-edit-workflow-${template.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                    data-testid={`button-duplicate-workflow-${template.id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-slate-600 mb-6 leading-relaxed" data-testid={`text-template-description-${template.id}`}>
                {template.description}
              </p>
              
              <div className="space-y-3 mb-6">
                {template.steps.map((step, index) => (
                  <div key={index} className="flex items-center text-sm p-3 bg-slate-50/80 rounded-lg">
                    <div className="w-8 h-8 bg-[#17B6C3] rounded-full text-white flex items-center justify-center mr-3 text-xs font-bold">
                      {index + 1}
                    </div>
                    <div className="flex items-center text-slate-700">
                      <Clock className="h-4 w-4 mr-2 text-[#17B6C3]" />
                      <span className="font-medium" data-testid={`text-step-${template.id}-${index}`}>
                        Day {step.day}: {step.action}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-auto pt-4 border-t border-slate-200/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-slate-700" data-testid={`text-success-rate-${template.id}`}>
                      {template.successRate} Success Rate
                    </span>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
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