import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  Search, 
  ChevronRight,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Banknote,
  CheckCircle2,
  TrendingUp,
  Clock
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useCurrency } from "@/hooks/useCurrency";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  status: string;
  dueDate: string;
  issueDate: string;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
}

const BASE_COVER_LIMIT = 2500;

function calculateInsuranceCoverage(invoiceAmount: number) {
  const covered = Math.min(invoiceAmount, BASE_COVER_LIMIT);
  const coveragePercentage = Math.round((covered / invoiceAmount) * 100);
  const needsUpgrade = invoiceAmount > BASE_COVER_LIMIT;
  const upgradeCost = needsUpgrade ? 19.80 : 0;
  
  return {
    covered,
    coveragePercentage,
    needsUpgrade,
    upgradeCost,
    uncovered: Math.max(0, invoiceAmount - BASE_COVER_LIMIT)
  };
}

function calculateFinanceOffer(invoiceAmount: number) {
  const advanceRate = 0.95;
  const advance = invoiceAmount * advanceRate;
  const fee = invoiceAmount * 0.008;
  
  return {
    advance,
    fee,
    total: advance - fee
  };
}

interface InsuranceWidgetProps {
  invoiceAmount: number;
  onClick: (e: React.MouseEvent) => void;
}

function InsuranceWidget({ invoiceAmount, onClick }: InsuranceWidgetProps) {
  const { coveragePercentage, needsUpgrade, upgradeCost } = calculateInsuranceCoverage(invoiceAmount);
  
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center sm:justify-start gap-2 px-3 py-3 sm:py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
      data-testid="button-insurance-coverage"
    >
      {needsUpgrade ? (
        <Shield className="h-4 w-4 text-emerald-600 flex-shrink-0" />
      ) : (
        <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
      )}
      <div className="text-left">
        <p className="text-xs font-semibold text-emerald-700">{coveragePercentage}% Covered</p>
        {needsUpgrade && (
          <p className="text-[10px] text-emerald-600">100% for £{upgradeCost.toFixed(2)}</p>
        )}
      </div>
    </button>
  );
}

interface FinanceButtonProps {
  onClick: (e: React.MouseEvent) => void;
}

function FinanceButton({ onClick }: FinanceButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center sm:justify-start gap-2 px-3 py-3 sm:py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
      data-testid="button-get-paid-now"
    >
      <Banknote className="h-4 w-4 text-blue-600 flex-shrink-0" />
      <p className="text-xs font-semibold text-blue-700">Get Paid Now</p>
    </button>
  );
}

interface FinanceOfferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

function FinanceOfferDialog({ isOpen, onClose, invoice }: FinanceOfferDialogProps) {
  if (!invoice) return null;
  
  const outstanding = invoice.amount - invoice.amountPaid;
  const { advance, fee, total } = calculateFinanceOffer(outstanding);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Banknote className="h-5 w-5 text-blue-600" />
            </div>
            Qashivo Wallet
          </DialogTitle>
          <DialogDescription>
            Financed by Kriya
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm text-slate-600 mb-1">You receive today</p>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(total)}</p>
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs text-emerald-600 font-medium">Auto-approved</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Invoice Amount ({invoice.invoiceNumber})</span>
              <span className="text-sm font-semibold text-slate-900">{formatCurrency(outstanding)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Advance (95%)</span>
              <span className="text-sm font-semibold text-blue-600">{formatCurrency(advance)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Finance Fee (0.8%)</span>
              <span className="text-sm font-semibold text-slate-900">-{formatCurrency(fee)}</span>
            </div>
            <div className="h-px bg-slate-200"></div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-900">Net to Wallet</span>
              <span className="text-lg font-bold text-emerald-600">{formatCurrency(total)}</span>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <Clock className="h-5 w-5 text-slate-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-900">How it works</p>
              <p className="text-xs text-slate-600 mt-1">
                Funds are credited to your Qashivo Wallet instantly. When your customer pays, 
                we automatically deduct the advance and release the balance to your bank.
              </p>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full sm:w-auto"
            data-testid="button-cancel-finance"
          >
            Not Now
          </Button>
          <Button 
            onClick={() => {
              onClose();
            }}
            className="w-full sm:w-auto bg-[#17B6C3] hover:bg-[#1396A1]"
            data-testid="button-accept-finance"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Accept Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface InsuranceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

function InsuranceDialog({ isOpen, onClose, invoice }: InsuranceDialogProps) {
  if (!invoice) return null;
  
  const outstanding = invoice.amount - invoice.amountPaid;
  const { covered, coveragePercentage, needsUpgrade, upgradeCost, uncovered } = calculateInsuranceCoverage(outstanding);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Shield className="h-5 w-5 text-emerald-600" />
            </div>
            Qashivo Insure
          </DialogTitle>
          <DialogDescription>
            Underwritten by Allianz Trade
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl p-4 border border-emerald-200">
            <p className="text-sm text-slate-600 mb-1">Current Coverage</p>
            <p className="text-3xl font-bold text-emerald-600">{coveragePercentage}%</p>
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs text-emerald-600 font-medium">Free base cover active</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Invoice Amount ({invoice.invoiceNumber})</span>
              <span className="text-sm font-semibold text-slate-900">{formatCurrency(outstanding)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Free Cover</span>
              <span className="text-sm font-semibold text-emerald-600">{formatCurrency(covered)}</span>
            </div>
            {needsUpgrade && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Uncovered</span>
                  <span className="text-sm font-semibold text-amber-600">{formatCurrency(uncovered)}</span>
                </div>
                <div className="h-px bg-slate-200"></div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">100% Coverage</p>
                    <p className="text-xs text-blue-600">Full protection upgrade</p>
                  </div>
                  <span className="text-lg font-bold text-blue-600">£{upgradeCost.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <ShieldCheck className="h-5 w-5 text-slate-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-900">Coverage Benefits</p>
              <p className="text-xs text-slate-600 mt-1">
                If your customer fails to pay, your insurance covers the loss. 
                {needsUpgrade ? ' Upgrade to 100% for complete peace of mind.' : ' You have full coverage on this invoice.'}
              </p>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full sm:w-auto"
            data-testid="button-close-insurance"
          >
            Close
          </Button>
          {needsUpgrade && (
            <Button 
              onClick={() => {
                onClose();
              }}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-upgrade-coverage"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Upgrade Coverage
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Invoices() {
  const [, setLocation] = useLocation();
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedInvoiceForInsurance, setSelectedInvoiceForInsurance] = useState<Invoice | null>(null);
  const [selectedInvoiceForFinance, setSelectedInvoiceForFinance] = useState<Invoice | null>(null);
  const limit = 20;

  const { data: invoicesData, isLoading } = useQuery<{
    invoices: Invoice[];
    aggregates: { totalOutstanding: number; overdueCount: number; pendingCount: number; paidCount: number; totalInvoices: number };
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ['/api/invoices', { status: statusFilter, search, page, limit }],
  });

  const invoices = invoicesData?.invoices || [];
  const aggregates = invoicesData?.aggregates || { totalOutstanding: 0, overdueCount: 0, pendingCount: 0, paidCount: 0, totalInvoices: 0 };
  const pagination = invoicesData?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const getStatusBadge = (invoice: Invoice) => {
    const daysOverdue = getDaysOverdue(invoice.dueDate);
    
    if (invoice.status === 'paid') {
      return <Badge className="badge-success">Paid</Badge>;
    } else if (daysOverdue === 0) {
      return <Badge className="badge-info">Due Today</Badge>;
    } else if (daysOverdue < 7) {
      return <Badge className="badge-success">Due</Badge>;
    } else if (daysOverdue < 30) {
      return <Badge className="badge-warning">Overdue</Badge>;
    } else {
      return <Badge className="badge-error">Critical</Badge>;
    }
  };

  const getStatusColor = (invoice: Invoice) => {
    const daysOverdue = getDaysOverdue(invoice.dueDate);
    
    if (invoice.status === 'paid') return 'border-l-emerald-500';
    if (daysOverdue < 7) return 'border-l-blue-500';
    if (daysOverdue < 30) return 'border-l-amber-500';
    return 'border-l-red-500';
  };

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 overflow-y-auto main-with-bottom-nav">
        <Header 
          title="Invoices" 
          subtitle="Manage your receivables"
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="input-apple pl-10"
                data-testid="input-search-invoices"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px] input-apple" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Total</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {aggregates.totalInvoices}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Overdue</p>
              <p className="text-lg sm:text-xl font-bold text-amber-600">
                {aggregates.overdueCount}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Paid</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-600">
                {aggregates.paidCount}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Outstanding</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {formatCurrency(aggregates.totalOutstanding)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="card-apple p-4">
                  <div className="h-24 bg-slate-200 animate-pulse rounded"></div>
                </div>
              ))
            ) : invoices.length === 0 ? (
              <div className="card-apple p-8 text-center">
                <p className="text-slate-600">No invoices found</p>
              </div>
            ) : (
              invoices.map((invoice) => {
                const outstanding = invoice.amount - invoice.amountPaid;
                const daysOverdue = getDaysOverdue(invoice.dueDate);
                
                return (
                  <div 
                    key={invoice.id} 
                    className={`card-apple-hover p-4 border-l-4 ${getStatusColor(invoice)} cursor-pointer`}
                    onClick={() => setLocation(`/invoices/${invoice.id}`)}
                    data-testid={`invoice-item-${invoice.id}`}
                  >
                    {/* Desktop: horizontal layout with buttons on right */}
                    {/* Mobile: stacked layout with full-width buttons below */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 truncate">
                              {invoice.contact?.name || 'Unknown Customer'}
                            </h4>
                            <p className="text-sm text-slate-600">
                              {invoice.invoiceNumber}
                            </p>
                          </div>
                          {getStatusBadge(invoice)}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-slate-900">
                              {formatCurrency(outstanding)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {invoice.status !== 'paid' && daysOverdue > 0 
                                ? `${daysOverdue} days overdue`
                                : `Due ${new Date(invoice.dueDate).toLocaleDateString()}`
                              }
                            </p>
                          </div>
                          {/* Chevron on mobile - inline with amount */}
                          <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 sm:hidden" />
                        </div>
                      </div>
                      
                      {invoice.status !== 'paid' && (
                        <div className="flex flex-row sm:flex-col gap-2 sm:mr-2">
                          <InsuranceWidget 
                            invoiceAmount={outstanding}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoiceForInsurance(invoice);
                            }}
                          />
                          <FinanceButton 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoiceForFinance(invoice);
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Chevron on desktop - at far right */}
                      <ChevronRight className="hidden sm:block h-5 w-5 text-slate-400 flex-shrink-0 mt-1" />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!isLoading && invoices.length > 0 && pagination.totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pb-4">
              <p className="text-sm text-slate-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} invoices
              </p>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                  className="touch-target"
                  data-testid="button-previous-page"
                >
                  Previous
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(pageNum => {
                      const isMobile = window.innerWidth < 640;
                      if (isMobile) {
                        return Math.abs(pageNum - page) <= 1;
                      }
                      return Math.abs(pageNum - page) <= 2 || pageNum === 1 || pageNum === pagination.totalPages;
                    })
                    .map((pageNum, idx, arr) => (
                      <>
                        {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                          <span key={`ellipsis-${pageNum}`} className="px-2 py-1 text-slate-400">...</span>
                        )}
                        <Button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          className="touch-target min-w-[40px]"
                          data-testid={`button-page-${pageNum}`}
                        >
                          {pageNum}
                        </Button>
                      </>
                    ))}
                </div>
                
                <Button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  variant="outline"
                  size="sm"
                  className="touch-target"
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
      
      <InsuranceDialog 
        isOpen={!!selectedInvoiceForInsurance}
        onClose={() => setSelectedInvoiceForInsurance(null)}
        invoice={selectedInvoiceForInsurance}
      />
      
      <FinanceOfferDialog 
        isOpen={!!selectedInvoiceForFinance}
        onClose={() => setSelectedInvoiceForFinance(null)}
        invoice={selectedInvoiceForFinance}
      />
    </div>
  );
}
