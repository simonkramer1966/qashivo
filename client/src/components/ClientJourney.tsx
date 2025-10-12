import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, 
  Phone, 
  MessageSquare, 
  CreditCard, 
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

interface TimelineEvent {
  id: string;
  type: 'interaction' | 'payment' | 'segment_change';
  timestamp: Date;
  
  // Interaction fields
  eventType?: string;
  channel?: string;
  subject?: string;
  content?: string;
  sentiment?: string;
  status?: string;
  
  // Payment fields
  invoiceNumber?: string;
  amount?: number;
  amountPaid?: number;
  
  // Segment change fields
  segment?: string;
  color?: string;
  reason?: string;
}

interface JourneySummary {
  totalInteractions: number;
  totalPayments: number;
  currentSegment: string;
  segmentColor: string;
}

interface ClientJourneyProps {
  contactId: string;
}

export function ClientJourney({ contactId }: ClientJourneyProps) {
  const { data, isLoading } = useQuery<{
    timelineEvents: TimelineEvent[];
    summary: JourneySummary;
  }>({
    queryKey: [`/api/client-intelligence/clients/${contactId}/journey`],
    enabled: !!contactId,
  });

  const getEventIcon = (event: TimelineEvent) => {
    if (event.type === 'payment') {
      return <CreditCard className="w-4 h-4 text-green-600" />;
    }
    if (event.type === 'segment_change') {
      return <TrendingUp className="w-4 h-4" style={{ color: event.color }} />;
    }
    
    // Interaction icons based on channel
    switch (event.channel) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'sms':
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-green-600" />;
      case 'call':
      case 'voice':
        return <Phone className="w-4 h-4 text-purple-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-3 h-3 text-green-600" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-600" />;
      case 'pending':
      case 'scheduled':
        return <Clock className="w-3 h-3 text-amber-600" />;
      default:
        return null;
    }
  };

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment) return null;
    
    const colors = {
      positive: 'bg-green-100 text-green-800 border-green-200',
      neutral: 'bg-gray-100 text-gray-800 border-gray-200',
      negative: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <Badge 
        variant="outline" 
        className={`text-xs ${colors[sentiment as keyof typeof colors] || ''}`}
      >
        {sentiment}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader className="border-b border-gray-200/50 pb-3">
          <CardTitle className="text-lg font-bold text-gray-900">Client Journey</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader className="border-b border-gray-200/50 pb-3">
          <CardTitle className="text-lg font-bold text-gray-900">Client Journey</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-500 text-center">No journey data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg h-full flex flex-col">
      <CardHeader className="border-b border-gray-200/50 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-gray-900">Client Journey</CardTitle>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {data.summary.totalInteractions} interactions
            </span>
            <span className="flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              {data.summary.totalPayments} payments
            </span>
          </div>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="p-6">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" />

            {/* Timeline events */}
            <div className="space-y-6">
              {data.timelineEvents.map((event, index) => (
                <div key={event.id} className="relative flex gap-4" data-testid={`timeline-event-${event.id}`}>
                  {/* Icon */}
                  <div className="relative z-10 flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-gray-200 shadow-sm">
                      {getEventIcon(event)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="bg-white/70 rounded-lg p-4 border border-gray-200/50 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-gray-900" data-testid={`event-title-${event.id}`}>
                            {event.type === 'payment' && `Payment - ${event.invoiceNumber}`}
                            {event.type === 'segment_change' && `Segment Change: ${event.segment}`}
                            {event.type === 'interaction' && (event.subject || event.eventType)}
                          </h4>
                          {event.status && getStatusIcon(event.status)}
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap" data-testid={`event-time-${event.id}`}>
                          {format(new Date(event.timestamp), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>

                      {/* Payment details */}
                      {event.type === 'payment' && (
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-600 font-semibold" data-testid={`payment-amount-${event.id}`}>
                            £{event.amountPaid?.toLocaleString()}
                          </span>
                          {event.amount && event.amount > (event.amountPaid || 0) && (
                            <span className="text-gray-500">
                              of £{event.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Segment change details */}
                      {event.type === 'segment_change' && (
                        <div className="flex items-center gap-2">
                          <Badge 
                            style={{ backgroundColor: event.color }}
                            className="text-white text-xs"
                          >
                            {event.segment}
                          </Badge>
                          {event.reason && (
                            <span className="text-xs text-gray-600">{event.reason}</span>
                          )}
                        </div>
                      )}

                      {/* Interaction details */}
                      {event.type === 'interaction' && (
                        <div className="space-y-2">
                          {event.content && (
                            <p className="text-sm text-gray-700 line-clamp-2" data-testid={`interaction-content-${event.id}`}>
                              {event.content}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            {event.channel && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {event.channel}
                              </Badge>
                            )}
                            {getSentimentBadge(event.sentiment)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
