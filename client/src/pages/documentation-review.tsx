import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { FileCheck, Play, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AIUpdateSuggestion {
  section_id: string;
  field: string;
  current_value: any;
  suggested_value: any;
  reasoning: string;
  confidence: number;
}

interface SyncResult {
  message: string;
  changes: {
    affectedSections: Array<{
      section_id: string;
      section_name: string;
      changes: string[];
      confidence: 'high' | 'medium' | 'low';
    }>;
    filesChanged: string[];
    summary: string;
  };
  suggestions: AIUpdateSuggestion[];
}

export default function DocumentationReview() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Mutation to trigger sync
  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/documentation/sync", { baseBranch: "HEAD~1" }),
    onSuccess: (data: SyncResult) => {
      setSyncResult(data);
      toast({
        title: "Sync Complete",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync documentation",
        variant: "destructive",
      });
    },
  });

  // Mutation to apply updates
  const applyMutation = useMutation({
    mutationFn: (approvedSuggestions: AIUpdateSuggestion[]) => 
      apiRequest("POST", "/api/documentation/apply-updates", { approvedSuggestions }),
    onSuccess: (data: any) => {
      toast({
        title: "Updates Applied",
        description: `${data.updatesApplied} documentation updates applied successfully`,
      });
      setSyncResult(null);
      setSelectedSuggestions(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/documentation/content'] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to apply updates",
        variant: "destructive",
      });
    },
  });

  const handleToggleSuggestion = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleSelectAll = () => {
    if (syncResult?.suggestions) {
      if (selectedSuggestions.size === syncResult.suggestions.length) {
        setSelectedSuggestions(new Set());
      } else {
        setSelectedSuggestions(new Set(syncResult.suggestions.map((_, i) => i)));
      }
    }
  };

  const handleApplySelected = () => {
    if (!syncResult?.suggestions) return;
    
    const approved = Array.from(selectedSuggestions)
      .map(index => syncResult.suggestions[index])
      .filter(Boolean);
    
    if (approved.length === 0) {
      toast({
        title: "No Updates Selected",
        description: "Please select at least one update to apply",
        variant: "destructive",
      });
      return;
    }

    applyMutation.mutate(approved);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.5) return "text-amber-600";
    return "text-red-600";
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-green-500">High Confidence</Badge>;
    if (confidence >= 0.5) return <Badge className="bg-amber-500">Medium Confidence</Badge>;
    return <Badge className="bg-red-500">Low Confidence</Badge>;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      
      <main className="flex-1 overflow-y-auto">
        <Header title="Documentation Review" subtitle="Review and approve AI-generated documentation updates" />
        
        <div className="container mx-auto px-6 py-6 max-w-7xl">
          
          {/* Sync Control */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Detect Documentation Changes</CardTitle>
                  <CardDescription>
                    Analyze recent code changes and generate documentation update suggestions
                  </CardDescription>
                </div>
                <Button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-sync-docs"
                >
                  {syncMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Sync
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Sync Results */}
          {syncResult && (
            <>
              {/* Summary */}
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Sync Results</AlertTitle>
                <AlertDescription>
                  {syncResult.changes.summary}
                  {syncResult.suggestions.length > 0 && (
                    <span className="block mt-2">
                      <strong>{syncResult.suggestions.length}</strong> documentation updates suggested
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              {/* No suggestions */}
              {syncResult.suggestions.length === 0 ? (
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardContent className="py-12 text-center">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Documentation is Up to Date</h3>
                    <p className="text-gray-600">No updates needed at this time</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Action Bar */}
                  <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg mb-6">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            data-testid="button-select-all"
                          >
                            {selectedSuggestions.size === syncResult.suggestions.length ? "Deselect All" : "Select All"}
                          </Button>
                          <span className="text-sm text-gray-600">
                            {selectedSuggestions.size} of {syncResult.suggestions.length} selected
                          </span>
                        </div>
                        <Button
                          onClick={handleApplySelected}
                          disabled={selectedSuggestions.size === 0 || applyMutation.isPending}
                          className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                          data-testid="button-apply-selected"
                        >
                          {applyMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            <>
                              <FileCheck className="mr-2 h-4 w-4" />
                              Apply Selected ({selectedSuggestions.size})
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Suggestions List */}
                  <div className="space-y-4">
                    {syncResult.suggestions.map((suggestion, index) => (
                      <Card 
                        key={index} 
                        className={`bg-white/80 backdrop-blur-sm border-white/50 shadow-lg transition-all ${
                          selectedSuggestions.has(index) ? 'ring-2 ring-[#17B6C3]' : ''
                        }`}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={selectedSuggestions.has(index)}
                                onCheckedChange={() => handleToggleSuggestion(index)}
                                data-testid={`checkbox-suggestion-${index}`}
                              />
                              <div>
                                <CardTitle className="text-lg">
                                  {suggestion.section_id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} → {suggestion.field}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                  {suggestion.reasoning}
                                </CardDescription>
                              </div>
                            </div>
                            {getConfidenceBadge(suggestion.confidence)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                Current Value
                              </h4>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                                {JSON.stringify(suggestion.current_value, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Suggested Value
                              </h4>
                              <pre className="bg-green-50 p-3 rounded text-xs overflow-auto max-h-40">
                                {JSON.stringify(suggestion.suggested_value, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Initial State */}
          {!syncResult && !syncMutation.isPending && (
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="py-12 text-center">
                <FileCheck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ready to Review Documentation</h3>
                <p className="text-gray-600 mb-4">
                  Click "Run Sync" to analyze recent code changes and detect documentation updates
                </p>
              </CardContent>
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}
