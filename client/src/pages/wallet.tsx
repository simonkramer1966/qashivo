import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  CreditCard,
  Wallet as WalletIcon,
  TrendingUp,
  DollarSign,
  Shield,
  Building2,
  Download,
  Upload,
  Settings
} from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";

interface WalletBalance {
  currentBalance: number;
  pendingIncoming: number;
  pendingOutgoing: number;
  availableBalance: number;
}

interface WalletSummary {
  customerPayments: number;
  insurancePayouts: number;
  financeAdvances: number;
  premiumsPaid: number;
}

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { formatCurrency } = useCurrency();

  // Fetch wallet balance
  const { data: balance, isLoading: balanceLoading } = useQuery<WalletBalance>({
    queryKey: ['/api/wallet/balance'],
  });

  // Fetch wallet summary
  const { data: summary, isLoading: summaryLoading } = useQuery<WalletSummary>({
    queryKey: ['/api/wallet/summary'],
  });

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto main-with-bottom-nav bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <Header 
          title="Qashivo Wallet"
          subtitle="Your unified financial hub"
          titleSize="text-2xl"
          subtitleSize="text-sm"
        />

        <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Wallet Balance Header - Sticky on mobile */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl sticky top-0 z-10 sm:static" data-testid="card-wallet-balance">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#17B6C3]/10 rounded-lg">
                  <WalletIcon className="h-6 w-6 text-[#17B6C3]" data-testid="icon-wallet" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl" data-testid="text-balance-title">Available Balance</CardTitle>
                  <CardDescription data-testid="text-balance-subtitle">Current wallet funds</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="hidden sm:flex h-10 bg-white/70"
                  data-testid="button-withdraw"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Withdraw
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="hidden sm:flex h-10 bg-white/70"
                  data-testid="button-top-up"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Top Up
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-10"
                  data-testid="button-settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {balanceLoading ? (
              <div className="animate-pulse">
                <div className="h-12 bg-gray-200 rounded w-48"></div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-gray-900" data-testid="text-available-balance">
                    {formatCurrency(balance?.currentBalance || 0)}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600 flex items-center gap-1" data-testid="text-pending-incoming">
                      <ArrowDownCircle className="h-4 w-4" />
                      {formatCurrency(balance?.pendingIncoming || 0)} incoming
                    </span>
                    <span className="text-orange-600 flex items-center gap-1" data-testid="text-pending-outgoing">
                      <ArrowUpCircle className="h-4 w-4" />
                      {formatCurrency(balance?.pendingOutgoing || 0)} outgoing
                    </span>
                  </div>
                </div>

                {/* Mobile action buttons */}
                <div className="flex gap-2 sm:hidden">
                  <Button className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1]" data-testid="button-withdraw-mobile">
                    <Upload className="h-4 w-4 mr-2" />
                    Withdraw
                  </Button>
                  <Button className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1]" data-testid="button-top-up-mobile">
                    <Download className="h-4 w-4 mr-2" />
                    Top Up
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white/80 backdrop-blur-sm border border-white/50 shadow-md h-auto p-1" data-testid="tabs-wallet-navigation">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white text-xs sm:text-sm py-2" data-testid="tab-overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white text-xs sm:text-sm py-2" data-testid="tab-transactions">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white text-xs sm:text-sm py-2" data-testid="tab-invoices">
              Invoices
            </TabsTrigger>
            <TabsTrigger value="insurance" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white text-xs sm:text-sm py-2" data-testid="tab-insurance">
              Insurance
            </TabsTrigger>
            <TabsTrigger value="finance" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white text-xs sm:text-sm py-2" data-testid="tab-finance">
              Finance
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Summary Cards */}
            {summaryLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                    <CardContent className="p-6">
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                        <div className="h-8 bg-gray-200 rounded w-32"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-customer-payments">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <p className="text-sm text-gray-600 mb-1" data-testid="text-label-customer-payments">Customer Payments</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-value-customer-payments">
                      {formatCurrency(summary?.customerPayments || 0)}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-insurance-payouts">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Shield className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-1" data-testid="text-label-insurance-payouts">Insurance Payouts</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-value-insurance-payouts">
                      {formatCurrency(summary?.insurancePayouts || 0)}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-finance-advances">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Building2 className="h-5 w-5 text-purple-600" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-1" data-testid="text-label-finance-advances">Finance Advances</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-value-finance-advances">
                      {formatCurrency(summary?.financeAdvances || 0)}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-premiums-paid">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <CreditCard className="h-5 w-5 text-orange-600" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-1" data-testid="text-label-premiums-paid">Premiums Paid</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-value-premiums-paid">
                      {formatCurrency(summary?.premiumsPaid || 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Activity Feed Placeholder */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-activity-feed">
              <CardHeader>
                <CardTitle className="text-xl" data-testid="text-activity-title">Recent Activity</CardTitle>
                <CardDescription data-testid="text-activity-subtitle">Latest wallet transactions and events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500" data-testid="text-activity-empty">
                  <WalletIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Activity feed coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-transactions">
              <CardHeader>
                <CardTitle className="text-xl" data-testid="text-transactions-title">Transaction History</CardTitle>
                <CardDescription data-testid="text-transactions-subtitle">Full ledger of wallet activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500" data-testid="text-transactions-empty">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Transactions view coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-invoices-wallet">
              <CardHeader>
                <CardTitle className="text-xl" data-testid="text-invoices-title">Invoice Finance & Insurance</CardTitle>
                <CardDescription data-testid="text-invoices-subtitle">Manage financed and insured invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500" data-testid="text-invoices-empty">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Invoice management coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Insurance Tab */}
          <TabsContent value="insurance" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-insurance">
              <CardHeader>
                <CardTitle className="text-xl" data-testid="text-insurance-title">Insurance Coverage</CardTitle>
                <CardDescription data-testid="text-insurance-subtitle">Active policies and claims</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500" data-testid="text-insurance-empty">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Insurance management coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-finance">
              <CardHeader>
                <CardTitle className="text-xl" data-testid="text-finance-title">Invoice Financing</CardTitle>
                <CardDescription data-testid="text-finance-subtitle">Advances and repayments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500" data-testid="text-finance-empty">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Finance management coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
