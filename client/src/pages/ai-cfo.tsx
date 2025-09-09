import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bot, 
  Brain, 
  Mic, 
  MicOff,
  Send, 
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  Target,
  MessageCircle,
  Phone,
  Loader2
} from "lucide-react";

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AiCfo() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationMode, setConversationMode] = useState<'text' | 'voice'>('text');
  const [isRecording, setIsRecording] = useState(false);

  // Fetch AR data for context
  const { data: dashboardData } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
    enabled: isAuthenticated,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['/api/invoices'],
    enabled: isAuthenticated,
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Initialize with welcome message
  useEffect(() => {
    if (isAuthenticated && messages.length === 0) {
      const welcomeMessage: Message = {
        id: '1',
        type: 'assistant',
        content: `Hello! I'm your AI CFO advisor. I can help you optimize your accounts receivable, improve cashflow, and provide strategic financial insights based on your current AR performance. 

I can see you currently have ${(dashboardData as any)?.totalOutstanding ? `$${(dashboardData as any).totalOutstanding.toLocaleString()}` : 'substantial amounts'} in outstanding receivables. How can I help you today?`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isAuthenticated, dashboardData, messages.length]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    try {
      // TODO: Implement AI CFO API call
      // For now, simulate a response
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: "I'm analyzing your AR data and will provide specific recommendations shortly. This feature is being implemented with full access to your receivables data for contextual advice.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiResponse]);
        setIsTyping(false);
      }, 2000);
    } catch (error) {
      setIsTyping(false);
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleVoiceMode = () => {
    setConversationMode(prev => prev === 'text' ? 'voice' : 'text');
    if (conversationMode === 'voice') {
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    setIsRecording(prev => !prev);
    // TODO: Implement voice recording functionality
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AI CFO...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#ffffff' }}>
      <NewSidebar />
      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#ffffff' }}>
        <Header title="AI CFO" subtitle="Your intelligent financial advisor for accounts receivable optimization" />
        
        <div className="p-8 space-y-6" style={{ backgroundColor: '#ffffff' }}>
          {/* AI CFO Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Outstanding</p>
                    <p className="text-3xl font-bold text-gray-900">
                      ${(dashboardData as any)?.totalOutstanding?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <DollarSign className="h-6 w-6 text-[#17B6C3]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Overdue Amount</p>
                    <p className="text-3xl font-bold text-gray-900">
                      ${(dashboardData as any)?.overdueAmount?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <Clock className="h-6 w-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Collection Rate</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {(dashboardData as any)?.collectionRate || '85'}%
                    </p>
                  </div>
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Target className="h-6 w-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Contacts</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {(dashboardData as any)?.activeContacts || '0'}
                    </p>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Users className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conversation Interface */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <Brain className="h-6 w-6 text-[#17B6C3]" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">AI CFO Conversation</CardTitle>
                    <CardDescription>Get personalized financial advice for your accounts receivable</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={conversationMode === 'text' ? 'default' : 'outline'}>
                    <MessageCircle className="h-3 w-3 mr-1" />
                    Text
                  </Badge>
                  <Badge 
                    variant={conversationMode === 'voice' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={toggleVoiceMode}
                  >
                    <Phone className="h-3 w-3 mr-1" />
                    Voice
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Messages Area */}
              <ScrollArea className="h-96 w-full rounded-md border p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-[#17B6C3] text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                        <div className="flex items-center space-x-1">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">AI CFO is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input Area */}
              {conversationMode === 'text' ? (
                <div className="flex space-x-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask about your AR performance, collection strategies, or cashflow optimization..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1"
                    data-testid="input-ai-cfo-message"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={!inputMessage.trim() || isTyping}
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-4">
                  <Button
                    onClick={toggleRecording}
                    className={`${isRecording 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-[#17B6C3] hover:bg-[#1396A1]'
                    } text-white px-8 py-3`}
                    data-testid="button-voice-record"
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="h-5 w-5 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="h-5 w-5 mr-2" />
                        Start Voice Chat
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-gray-600">
                    {isRecording ? 'Listening... Speak your question' : 'Click to start voice conversation'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Action Suggestions */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Quick Questions</CardTitle>
              <CardDescription>Common AR and cashflow questions to get you started</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "What's my biggest collection opportunity right now?",
                  "How can I improve my days sales outstanding?",
                  "Which customers should I prioritize for follow-up?",
                  "What's causing my collection delays?",
                  "How does my AR performance compare to industry benchmarks?",
                  "What collection strategies work best for my customer segments?"
                ].map((question) => (
                  <Button
                    key={question}
                    variant="outline"
                    className="text-left h-auto p-3 text-wrap"
                    onClick={() => {
                      setInputMessage(question);
                      if (conversationMode === 'text') {
                        sendMessage();
                      }
                    }}
                    data-testid={`button-quick-question-${question.slice(0, 20)}`}
                  >
                    <div className="w-full text-sm">{question}</div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}