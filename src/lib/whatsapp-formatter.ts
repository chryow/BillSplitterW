import { formatCurrency } from "./currency";
import type { FeeSplitMode, PaymentInfo, SplitCalculationResult } from "./types";

export interface WhatsAppSummaryOptions {
  merchantName: string;
  feeSplitMode: FeeSplitMode;
  split: SplitCalculationResult;
  paymentInfo?: PaymentInfo;
  shareUrl?: string | null;
  paidByParticipantId?: string | null;
  settledParticipantIds?: string[];
}

export function hasPaymentInfo(info?: PaymentInfo | null): boolean {
  if (!info) return false;
  return Boolean(
    info.provider.trim() ||
      info.accountNumber.trim() ||
      info.accountName.trim() ||
      info.note.trim()
  );
}

export function buildWhatsAppShareUrl(summaryText: string): string {
  return `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
}

/**
 * Generates a neat, paste-ready WhatsApp breakdown with per-person items,
 * custom share ratios, payer & settlement badges, fees/discount, totals,
 * and optional payment info / public link.
 */
export function formatWhatsAppSummary(options: WhatsAppSummaryOptions): string {
  const {
    merchantName,
    split,
    paymentInfo,
    shareUrl,
    paidByParticipantId,
    settledParticipantIds = [],
  } = options;
  const cur = split.currency;
  const title = merchantName.trim() || "Split Bill";
  const settledSet = new Set(settledParticipantIds);
  const payer = paidByParticipantId
    ? split.people.find((p) => p.participantId === paidByParticipantId) ?? null
    : null;

  const lines: string[] = [];
  lines.push(`🧾 *${title}*`);
  lines.push(`Total: *${formatCurrency(split.grandTotal, cur)}*`);
  if (payer) {
    lines.push(`Paid by: *${payer.name}*`);
  }
  lines.push("");

  for (const person of split.people) {
    const isPayer = payer?.participantId === person.participantId;
    const isSettled = !isPayer && settledSet.has(person.participantId);
    const statusTag = isPayer
      ? " _(paid bill)_"
      : isSettled
        ? " ✅"
        : "";

    lines.push(
      `👤 *${person.name}* — *${formatCurrency(person.total, cur)}*${statusTag}`
    );

    for (const item of person.items) {
      const sharedSuffix = item.isCustomShare
        ? ` (${item.shareWeight}/${item.totalShares})`
        : item.shareCount > 1
          ? ` (÷${item.shareCount})`
          : "";
      const qtyPrefix = item.qty > 1 ? `${item.qty}x ` : "";
      lines.push(
        `  • ${qtyPrefix}${item.name}${sharedSuffix}: ${formatCurrency(item.amount, cur)}`
      );
    }

    const adjustments: string[] = [];
    if (person.taxShare > 0) {
      adjustments.push(`Tax ${formatCurrency(person.taxShare, cur)}`);
    }
    if (person.serviceShare > 0) {
      adjustments.push(`Svc ${formatCurrency(person.serviceShare, cur)}`);
    }
    if (person.discountShare > 0) {
      adjustments.push(`Disc -${formatCurrency(person.discountShare, cur)}`);
    }
    if (adjustments.length > 0) {
      lines.push(`  _↳ ${adjustments.join(" · ")}_`);
    }

    lines.push("");
  }

  if (split.unassignedItemIds.length > 0) {
    lines.push(
      `⚠️ Unassigned items: ${formatCurrency(split.unassignedSubtotal, cur)}`
    );
    lines.push("");
  }

  if (hasPaymentInfo(paymentInfo) && paymentInfo) {
    lines.push(
      payer ? `💳 *Transfer to ${payer.name}*` : "💳 *Payment Info*"
    );
    const headerParts = [
      paymentInfo.provider.trim(),
      paymentInfo.accountNumber.trim(),
    ].filter(Boolean);
    if (headerParts.length > 0) {
      lines.push(headerParts.join(" · "));
    }
    if (paymentInfo.accountName.trim()) {
      lines.push(`a/n ${paymentInfo.accountName.trim()}`);
    }
    if (paymentInfo.note.trim()) {
      lines.push(paymentInfo.note.trim());
    }
    lines.push("");
  }

  if (shareUrl) {
    lines.push(`🔗 Breakdown link: ${shareUrl}`);
    lines.push("");
  }

  lines.push("_Split with BillSplitterW_");
  return lines.join("\n").trim();
}
