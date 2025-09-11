import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "../../../shared/utils/dateFormatter";
import { useAuth } from "@/hooks/useAuth";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, CreditCard, Calendar, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ProfileData {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    role: string;
    createdAt: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    created: string;
    customer: {
      id: string;
      email: string | null;
      name: string | null;
    };
    items: Array<{
      id: string;
      priceId: string;
      quantity: number;
      amount: number;
      currency: string;
      interval: string;
    }>;
  } | null;
}

export default function Profile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  const { data: profileData, isLoading, error } = useQuery<ProfileData>({
    queryKey: ['/api/profile/subscription'],
    enabled: isAuthenticated,
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/profile/cancel-subscription'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile/subscription'] });
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will be cancelled at the end of the current billing period.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/profile/reactivate-subscription'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile/subscription'] });
      toast({
        title: "Subscription Reactivated",
        description: "Your subscription has been reactivated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reactivate subscription",
        variant: "destructive",
      });
    },
  });

  const createSubscription = async () => {
    setIsCreatingSubscription(true);
    try {
      const response = await apiRequest('POST', '/api/profile/create-subscription');
      const data = await response.json();
      
      if (data.clientSecret) {
        // Here you would typically redirect to Stripe Checkout or handle payment
        toast({
          title: "Subscription Created",
          description: "Your subscription has been created successfully.",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/profile/subscription'] });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create subscription",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen page-gradient">
        <NewSidebar />
        <main className="flex-1 overflow-y-auto">
          <Header title="Profile" subtitle="Manage your account settings and subscription" />
          <div className="p-8">
            <div className="animate-spin w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full mx-auto" />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen page-gradient">
        <NewSidebar />
        <main className="flex-1 overflow-y-auto">
          <Header title="Profile" subtitle="Manage your account settings and subscription" />
          <div className="p-8">
            <Card className="card-glass border-red-200/50">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Profile</h3>
                <p className="text-gray-600">Please try refreshing the page or contact support if the problem persists.</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const { user, subscription } = profileData || {};

  const getSubscriptionStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
      case 'canceled':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Cancelled</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Past Due</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen page-gradient">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header title="Profile" subtitle="Manage your account settings and subscription details" />
        
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-8">
              {/* User Profile Card */}
              <Card className="card-glass" data-testid="card-user-profile">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <User className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">User Information</CardTitle>
                  <CardDescription>Your account details and preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-600">Full Name</label>
                  <p className="text-lg font-medium text-gray-900" data-testid="text-user-name">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user?.email || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Email Address</label>
                  <p className="text-lg font-medium text-gray-900" data-testid="text-user-email">
                    {user?.email || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Account Role</label>
                  <div className="mt-1">
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200" data-testid="badge-user-role">
                      {user?.role || 'User'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Member Since</label>
                  <p className="text-lg font-medium text-gray-900" data-testid="text-user-created">
                    {user?.createdAt ? formatDate(user.createdAt) : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Card */}
          <Card className="card-glass" data-testid="card-subscription">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <CreditCard className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Subscription Details</CardTitle>
                  <CardDescription>Manage your Qashivo subscription</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {subscription ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">Current Plan</h4>
                      <p className="text-gray-600">Professional Plan</p>
                    </div>
                    <div data-testid="badge-subscription-status">
                      {getSubscriptionStatusBadge(subscription.status)}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Current Period
                      </label>
                      <p className="text-sm text-gray-900 mt-1" data-testid="text-billing-period">
                        {formatDate(subscription.currentPeriodStart)} - {' '}
                        {formatDate(subscription.currentPeriodEnd)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Monthly Cost</label>
                      <p className="text-sm text-gray-900 mt-1" data-testid="text-subscription-amount">
                        ${subscription.items[0]?.amount ? (subscription.items[0].amount / 100).toFixed(2) : '0.00'} / month
                      </p>
                    </div>
                  </div>

                  {subscription.cancelAtPeriodEnd && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">Subscription Cancellation Pending</span>
                      </div>
                      <p className="text-yellow-700 mt-1 text-sm">
                        Your subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {subscription.cancelAtPeriodEnd ? (
                      <Button
                        onClick={() => reactivateMutation.mutate()}
                        disabled={reactivateMutation.isPending}
                        className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                        data-testid="button-reactivate-subscription"
                      >
                        {reactivateMutation.isPending ? (
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Reactivate Subscription
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            data-testid="button-cancel-subscription"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancel Subscription
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel your subscription? Your access will continue until the end of your current billing period on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => cancelMutation.mutate()}
                              className="bg-red-600 hover:bg-red-700"
                              data-testid="button-confirm-cancel"
                            >
                              Yes, Cancel Subscription
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No Active Subscription</h4>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Subscribe to Qashivo Professional to access advanced features like automated workflows, AI-powered suggestions, and comprehensive analytics.
                  </p>
                  <Button
                    onClick={createSubscription}
                    disabled={isCreatingSubscription}
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                    data-testid="button-create-subscription"
                  >
                    {isCreatingSubscription ? (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    Subscribe Now - $29/month
                  </Button>
                </div>
              )}
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}