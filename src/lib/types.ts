export type CurrencyCode = "IDR" | "USD" | "SGD" | "MYR" | "EUR" | "JPY";

export type FeeSplitMode = "proportional" | "equal";

export type AppStep = 1 | 2 | 3 | 4;

export interface ScannedReceiptItem {
  name: string;
  qty: number;
  unit_price: number;
  total_price: number;
}

export interface ReceiptConversionInfo {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  source: "live" | "fallback";
  originalGrandTotal: number | null;
}

export interface ScannedReceiptResponse {
  merchant_name: string | null;
  currency: string | null;
  items: ScannedReceiptItem[];
  subtotal: number | null;
  tax: number;
  service_charge: number;
  delivery_fee?: number;
  discount: number;
  grand_total: number | null;
  warnings: string[];
  conversion?: ReceiptConversionInfo;
}

export interface BillItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  assigneeIds: string[];
  /**
   * Optional custom relative share weights per participantId (e.g. { p1: 2, p2: 1 } for 2/3 vs 1/3).
   * Missing entries default to 1 share.
   */
  assigneeShares?: Record<string, number>;
}

export interface Participant {
  id: string;
  name: string;
  color: string;
}

export interface PaymentInfo {
  provider: string;
  accountNumber: string;
  accountName: string;
  note: string;
}

export interface BillState {
  savedBillId: string | null;
  shareSlug: string | null;
  isPublic: boolean;
  merchantName: string;
  currency: CurrencyCode;
  items: BillItem[];
  tax: number;
  serviceCharge: number;
  deliveryFee: number;
  discount: number;
  scannedGrandTotal: number | null;
  warnings: string[];
  conversion?: ReceiptConversionInfo | null;
  participants: Participant[];
  feeSplitMode: FeeSplitMode;
  /** Participant ID of whoever paid the restaurant/merchant (null if unspecified). */
  paidByParticipantId: string | null;
  /** Participant IDs who have already transferred their share. */
  settledParticipantIds: string[];
}

export interface PersonAssignedItem {
  itemId: string;
  name: string;
  qty: number;
  shareCount: number;
  shareWeight: number;
  totalShares: number;
  isCustomShare: boolean;
  amount: number;
}

export interface PersonSplit {
  participantId: string;
  name: string;
  color: string;
  items: PersonAssignedItem[];
  itemSubtotal: number;
  taxShare: number;
  serviceShare: number;
  deliveryShare: number;
  discountShare: number;
  total: number;
}

export interface SplitCalculationResult {
  currency: CurrencyCode;
  itemsSubtotal: number;
  tax: number;
  serviceCharge: number;
  deliveryFee: number;
  discount: number;
  grandTotal: number;
  assignedSubtotal: number;
  unassignedSubtotal: number;
  unassignedItemIds: string[];
  people: PersonSplit[];
  sumOfPeopleTotals: number;
}

export interface SettlementSummary {
  payerId: string | null;
  payerName: string | null;
  totalOwedToPayer: number;
  totalCollected: number;
  totalRemaining: number;
  collectibleCount: number;
  settledCount: number;
  unsettledCount: number;
}

export interface SavedFriend {
  id: string;
  name: string;
  color: string;
}

export interface SavedBillSummary {
  id: string;
  share_slug: string;
  is_public: boolean;
  merchant_name: string;
  currency: CurrencyCode;
  fee_split_mode: FeeSplitMode;
  subtotal: number;
  tax: number;
  service_charge: number;
  delivery_fee: number;
  discount: number;
  grand_total: number;
  items: BillItem[];
  participants: Participant[];
  payment_info: PaymentInfo;
  paid_by_participant_id: string | null;
  settled_participant_ids: string[];
  created_at: string;
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  default_currency: CurrencyCode;
  payment_info: PaymentInfo;
}

export interface ScanQuota {
  used: number;
  remaining: number;
  limit: number;
  resetAt?: string;
}

export interface ScanApiError {
  code:
    | "AUTH_REQUIRED"
    | "MISSING_API_KEY"
    | "RATE_LIMITED"
    | "INVALID_FILE"
    | "FILE_TOO_LARGE"
    | "OCR_FAILED";
  message: string;
  retryAfterSeconds?: number;
}

export type AppMode = "bill" | "trips";

export type TripExpenseCategory =
  | "food"
  | "stay"
  | "transport"
  | "activity"
  | "other";

export interface TripMember {
  id: string;
  name: string;
  color: string;
  paymentInfo?: PaymentInfo;
}

export interface TripExpense {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: TripExpenseCategory;
  paidByMemberId: string;
  mode: "quick" | "itemized";
  /** Total amount for quick-mode bills */
  amount: number;
  /** Assigned member IDs for quick-mode bills */
  assigneeIds: string[];
  /** Optional custom relative share weights for quick-mode bills */
  assigneeShares?: Record<string, number>;
  /** Detailed itemized receipt lines when mode === "itemized" */
  items?: BillItem[];
  tax?: number;
  serviceCharge?: number;
  deliveryFee?: number;
  discount?: number;
}

export interface Trip {
  id: string;
  savedTripId: string | null;
  shareSlug: string | null;
  isPublic: boolean;
  name: string;
  currency: CurrencyCode;
  members: TripMember[];
  expenses: TripExpense[];
  settledTransferKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TripExpenseComputed {
  expenseId: string;
  total: number;
  sharesByMemberId: Record<string, number>;
  unassignedAmount: number;
}

export interface TripMemberBalance {
  memberId: string;
  name: string;
  color: string;
  paymentInfo?: PaymentInfo;
  totalPaid: number;
  totalShare: number;
  /** Positive = owed money back; Negative = owes money */
  netBalance: number;
  paidCount: number;
}

export interface TripTransfer {
  key: string;
  fromMemberId: string;
  fromName: string;
  fromColor: string;
  toMemberId: string;
  toName: string;
  toColor: string;
  toPaymentInfo?: PaymentInfo;
  amount: number;
}

export interface TripCalculationResult {
  currency: CurrencyCode;
  totalSpend: number;
  expenseSummaries: Record<string, TripExpenseComputed>;
  balances: TripMemberBalance[];
  transfers: TripTransfer[];
}
