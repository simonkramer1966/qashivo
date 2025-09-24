import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface ExistingPaymentPlan {
  invoiceId: string;
  paymentPlan: {
    id: string;
    totalAmount: string;
    status: string;
    createdAt: string;
    contact: {
      id: string;
      name: string;
    };
  };
}

interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: ExistingPaymentPlan[];
  invoicesWithExistingPlans: string[];
}

export function usePaymentPlanValidation() {
  const [isChecking, setIsChecking] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);

  const checkForDuplicates = async (invoiceIds: string[]): Promise<DuplicateCheckResult> => {
    if (invoiceIds.length === 0) {
      const emptyResult = { hasDuplicates: false, duplicates: [], invoicesWithExistingPlans: [] };
      setDuplicateResult(emptyResult);
      return emptyResult;
    }

    setIsChecking(true);
    try {
      const response = await apiRequest('POST', '/api/payment-plans/check-duplicates', {
        invoiceIds
      });
      
      const result = await response.json() as DuplicateCheckResult;
      setDuplicateResult(result);
      return result;
    } catch (error) {
      console.error('Error checking for duplicate payment plans:', error);
      // Return no duplicates on error to allow creation
      const errorResult = { hasDuplicates: false, duplicates: [], invoicesWithExistingPlans: [] };
      setDuplicateResult(errorResult);
      return errorResult;
    } finally {
      setIsChecking(false);
    }
  };

  const clearDuplicateResult = () => {
    setDuplicateResult(null);
  };

  const getFormattedDuplicateMessage = (): string => {
    if (!duplicateResult?.hasDuplicates) return '';
    
    const count = duplicateResult.duplicates.length;
    const invoiceWord = count === 1 ? 'invoice' : 'invoices';
    const planWord = count === 1 ? 'plan' : 'plans';
    
    return `${count} selected ${invoiceWord} already have active payment ${planWord}`;
  };

  const getDuplicatesByContact = () => {
    if (!duplicateResult?.hasDuplicates) return {};
    
    const grouped: Record<string, ExistingPaymentPlan[]> = {};
    duplicateResult.duplicates.forEach(duplicate => {
      const contactName = duplicate.paymentPlan.contact.name;
      if (!grouped[contactName]) {
        grouped[contactName] = [];
      }
      grouped[contactName].push(duplicate);
    });
    
    return grouped;
  };

  return {
    isChecking,
    duplicateResult,
    checkForDuplicates,
    clearDuplicateResult,
    getFormattedDuplicateMessage,
    getDuplicatesByContact,
    hasDuplicates: duplicateResult?.hasDuplicates || false
  };
}