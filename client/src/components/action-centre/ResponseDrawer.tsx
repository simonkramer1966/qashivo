import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  MessageSquare,
  Send,
  Sparkles,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ResponseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: {
    id: string;
    contactName: string;
    email?: string;
    phone?: string;
    channel: string;
    subject?: string;
    message: string;
    intent?: string;
    sentiment?: string;
    createdAt: string;
  } | null;
}

export function ResponseDrawer({ open, onOpenChange, query }: ResponseDrawerProps) {
  const [draftResponse, setDraftResponse] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Generate AI-powered response draft
  const generateResponseMutation = useMutation({
    mutationFn: async () => {
      if (!query) return;
      
      return await apiRequest('POST', `/api/queries/${query.id}/generate-response`, {
        message: query.message,
        intent: query.intent,
        sentiment: query.sentiment,
        channel: query.channel,
      });
    },
    onSuccess: (data: any) => {
      setDraftResponse(data.draftResponse);
      toast({
        title: "Response generated",
        description: "AI has drafted a response for you. Feel free to edit before sending.",
      });
    },
    onError: () => {
      toast({
        title: "Generation failed",
        description: "Could not generate response. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send response
  const sendResponseMutation = useMutation({
    mutationFn: async () => {
      if (!query) return;
      
      return apiRequest('POST', `/api/queries/${query.id}/respond`, {
        response: draftResponse,
        channel: query.channel,
      });
    },
    onSuccess: () => {
      toast({
        title: "Response sent",
        description: `Your reply has been sent to ${query?.contactName}.`,
      });
      setDraftResponse("");
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Send failed",
        description: "Could not send response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateResponse = () => {
    setIsGenerating(true);
    generateResponseMutation.mutate();
    setTimeout(() => setIsGenerating(false), 1500);
  };

  const handleSendResponse = () => {
    if (!draftResponse.trim()) {
      toast({
        title: "Empty response",
        description: "Please write or generate a response before sending.",
        variant: "destructive",
      });
      return;
    }
    sendResponseMutation.mutate();
  };

  if (!query) return null;

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "negative":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "neutral":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#17B6C3]" />
            Response to Query
          </SheetTitle>
          <SheetDescription>
            Draft and send a response to {query.contactName}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 mt-6">
          {/* Contact Info */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/30 dark:border-gray-700/30 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold mb-2">Contact Details</h3>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">Name:</span>
                <span className="font-medium" data-testid="text-contact-name">{query.contactName}</span>
              </p>
              {query.email && (
                <p className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">Email:</span>
                  <span data-testid="text-contact-email">{query.email}</span>
                </p>
              )}
              {query.phone && (
                <p className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">Phone:</span>
                  <span data-testid="text-contact-phone">{query.phone}</span>
                </p>
              )}
            </div>
          </div>

          {/* Original Message */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/30 dark:border-gray-700/30 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Original Message</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  {getChannelIcon(query.channel)}
                  <span className="capitalize">{query.channel}</span>
                </Badge>
                {query.intent && (
                  <Badge variant="outline" className="capitalize">
                    {query.intent}
                  </Badge>
                )}
                {query.sentiment && (
                  <Badge className={getSentimentColor(query.sentiment)}>
                    {query.sentiment === "positive" && <ThumbsUp className="h-3 w-3 mr-1" />}
                    {query.sentiment === "negative" && <ThumbsDown className="h-3 w-3 mr-1" />}
                    {query.sentiment === "neutral" && <AlertCircle className="h-3 w-3 mr-1" />}
                    <span className="capitalize">{query.sentiment}</span>
                  </Badge>
                )}
              </div>
            </div>
            {query.subject && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Subject:</p>
                <p className="text-sm font-medium" data-testid="text-message-subject">{query.subject}</p>
              </div>
            )}
            <Separator className="my-2" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Message:</p>
              <p className="text-sm whitespace-pre-wrap" data-testid="text-message-body">
                {query.message}
              </p>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Received: {new Date(query.createdAt).toLocaleString()}
            </p>
          </div>

          {/* AI Response Generator */}
          <div className="bg-gradient-to-br from-[#17B6C3]/5 to-teal-50/50 dark:from-[#17B6C3]/10 dark:to-teal-900/10 border border-[#17B6C3]/20 dark:border-[#17B6C3]/30 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#17B6C3]" />
                AI Response Draft
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateResponse}
                disabled={isGenerating || generateResponseMutation.isPending}
                data-testid="button-generate-response"
              >
                {isGenerating || generateResponseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Draft
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Click 'Generate Draft' to create an AI-powered response, or write your own..."
              value={draftResponse}
              onChange={(e) => setDraftResponse(e.target.value)}
              className="min-h-[200px] bg-white/80 dark:bg-gray-900/80"
              data-testid="input-response-draft"
            />
          </div>

          {/* Quick Reply Suggestions */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Quick Replies</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraftResponse(`Hi ${query.contactName.split(' ')[0]},\n\nThank you for your message. I'll look into this and get back to you shortly.\n\nBest regards`)}
                data-testid="button-quick-acknowledge"
              >
                Acknowledge
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraftResponse(`Hi ${query.contactName.split(' ')[0]},\n\nI've reviewed your account and can confirm this has been resolved. Please let me know if you need anything else.\n\nBest regards`)}
                data-testid="button-quick-resolved"
              >
                Mark Resolved
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraftResponse(`Hi ${query.contactName.split(' ')[0]},\n\nI need a bit more information to assist you. Could you please provide [details]?\n\nThank you`)}
                data-testid="button-quick-moreinfo"
              >
                Request Info
              </Button>
            </div>
          </div>
        </ScrollArea>

        {/* Send Button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            onClick={handleSendResponse}
            disabled={!draftResponse.trim() || sendResponseMutation.isPending}
            data-testid="button-send-response"
          >
            {sendResponseMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Response
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
