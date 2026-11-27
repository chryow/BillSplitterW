import { formatCurrency } from "./currency";
import type { PaymentInfo, SplitCalculationResult } from "./types";
import { hasPaymentInfo } from "./whatsapp-formatter";

export interface SplitCardImageOptions {
  merchantName: string;
  split: SplitCalculationResult;
  paidByParticipantId?: string | null;
  settledParticipantIds?: string[];
  paymentInfo?: PaymentInfo;
  roundingStep?: number;
  dateLabel?: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

/**
 * Renders a crisp 2x retina dark-mode PNG split summary card via HTML Canvas
 * suitable for sharing directly into WhatsApp/Instagram group chats.
 */
export async function generateSplitCardPng(
  options: SplitCardImageOptions
): Promise<Blob> {
  const {
    merchantName,
    split,
    paidByParticipantId,
    settledParticipantIds = [],
    paymentInfo,
    roundingStep = 0,
    dateLabel,
  } = options;

  const cur = split.currency;
  const settledSet = new Set(settledParticipantIds);
  const payer = paidByParticipantId
    ? split.people.find((p) => p.participantId === paidByParticipantId) ?? null
    : null;
  const showPayment = hasPaymentInfo(paymentInfo);

  const width = 440;
  const pad = 24;
  const cardPad = 16;
  const headerHeight = 108;
  const personRowHeights = split.people.map((p) => {
    const visibleItems = Math.min(p.items.length, 4);
    const hasOverflow = p.items.length > 4 ? 1 : 0;
    const hasFees =
      p.taxShare > 0 ||
      p.serviceShare > 0 ||
      p.deliveryShare > 0 ||
      p.discountShare > 0
        ? 1
        : 0;
    return 44 + (visibleItems + hasOverflow) * 18 + hasFees * 16 + 10;
  });
  const peopleBlockHeight =
    personRowHeights.reduce((sum, h) => sum + h + 10, 0) || 40;
  const paymentBlockHeight = showPayment ? 86 : 0;
  const footerHeight = 42;
  const totalHeight =
    pad +
    headerHeight +
    14 +
    peopleBlockHeight +
    (showPayment ? paymentBlockHeight + 12 : 0) +
    footerHeight +
    pad;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unavailable to generate image.");
  }

  ctx.scale(scale, scale);

  // App background
  ctx.fillStyle = "#0A0D12";
  ctx.fillRect(0, 0, width, totalHeight);

  const sans =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

  let y = pad;

  // Header card
  drawRoundedRect(ctx, pad, y, width - pad * 2, headerHeight, 16);
  ctx.fillStyle = "#12161F";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const innerX = pad + cardPad;
  const rightX = width - pad - cardPad;

  ctx.font = `600 11px ${sans}`;
  ctx.fillStyle = "#34D399";
  ctx.textAlign = "left";
  ctx.fillText(
    `SPLIT SUMMARY${dateLabel ? `  ·  ${dateLabel.toUpperCase()}` : ""}`,
    innerX,
    y + 24
  );

  ctx.font = `700 20px ${sans}`;
  ctx.fillStyle = "#F8FAFC";
  ctx.fillText(
    truncateText(ctx, merchantName.trim() || "Split Bill", width - pad * 2 - 140),
    innerX,
    y + 52
  );

  // Grand total on right
  ctx.textAlign = "right";
  ctx.font = `500 11px ${sans}`;
  ctx.fillStyle = "#94A3B8";
  ctx.fillText("GRAND TOTAL", rightX, y + 24);

  ctx.font = `700 19px ${mono}`;
  ctx.fillStyle = "#34D399";
  ctx.fillText(formatCurrency(split.grandTotal, cur), rightX, y + 52);

  // Divider inside header
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.moveTo(innerX, y + 68);
  ctx.lineTo(rightX, y + 68);
  ctx.stroke();

  // Sub-meta row
  ctx.textAlign = "left";
  ctx.font = `500 11px ${sans}`;
  ctx.fillStyle = "#94A3B8";
  const metaBits: string[] = [
    `Items ${formatCurrency(split.itemsSubtotal, cur)}`,
  ];
  if (split.tax > 0) metaBits.push(`Tax ${formatCurrency(split.tax, cur)}`);
  if (split.serviceCharge > 0) {
    metaBits.push(`Svc ${formatCurrency(split.serviceCharge, cur)}`);
  }
  if (split.deliveryFee > 0) {
    metaBits.push(`Deliv ${formatCurrency(split.deliveryFee, cur)}`);
  }
  if (split.discount > 0) {
    metaBits.push(`Disc -${formatCurrency(split.discount, cur)}`);
  }
  ctx.fillText(
    truncateText(ctx, metaBits.join("  ·  "), rightX - innerX),
    innerX,
    y + 90
  );

  y += headerHeight + 14;

  // Per-person cards
  split.people.forEach((person, idx) => {
    const rowH = personRowHeights[idx];
    const isPayer = payer?.participantId === person.participantId;
    const isSettled = !isPayer && settledSet.has(person.participantId);

    drawRoundedRect(ctx, pad, y, width - pad * 2, rowH, 14);
    ctx.fillStyle = "#12161F";
    ctx.fill();
    ctx.strokeStyle = isSettled
      ? "rgba(16,185,129,0.35)"
      : "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Color dot
    ctx.beginPath();
    ctx.arc(innerX + 5, y + 22, 5, 0, Math.PI * 2);
    ctx.fillStyle = person.color;
    ctx.fill();

    // Name + status
    ctx.textAlign = "left";
    ctx.font = `600 14px ${sans}`;
    ctx.fillStyle = "#F8FAFC";
    const statusSuffix = isPayer
      ? "  (Paid bill)"
      : isSettled
        ? "  ✓ Paid"
        : "";
    ctx.fillText(
      truncateText(ctx, `${person.name}${statusSuffix}`, rightX - innerX - 125),
      innerX + 18,
      y + 27
    );

    // Person total
    ctx.textAlign = "right";
    ctx.font = `700 15px ${mono}`;
    ctx.fillStyle = isSettled ? "#64748B" : "#F8FAFC";
    ctx.fillText(formatCurrency(person.total, cur), rightX, y + 27);

    // Line items (up to 4 + overflow summary)
    let itemY = y + 48;
    const shown = person.items.slice(0, 4);
    for (const item of shown) {
      const shareTag = item.isCustomShare
        ? ` (${item.shareWeight}/${item.totalShares})`
        : item.shareCount > 1
          ? ` (÷${item.shareCount})`
          : "";
      const qtyTag = item.qty > 1 ? `${item.qty}x ` : "";

      ctx.textAlign = "left";
      ctx.font = `400 11px ${sans}`;
      ctx.fillStyle = "#94A3B8";
      ctx.fillText(
        truncateText(
          ctx,
          `${qtyTag}${item.name || "Item"}${shareTag}`,
          rightX - innerX - 95
        ),
        innerX,
        itemY
      );

      ctx.textAlign = "right";
      ctx.font = `500 11px ${mono}`;
      ctx.fillStyle = "#CBD5E1";
      ctx.fillText(formatCurrency(item.amount, cur), rightX, itemY);
      itemY += 18;
    }

    if (person.items.length > 4) {
      ctx.textAlign = "left";
      ctx.font = `400 11px ${sans}`;
      ctx.fillStyle = "#64748B";
      ctx.fillText(
        `+${person.items.length - 4} more item${person.items.length - 4 > 1 ? "s" : ""}`,
        innerX,
        itemY
      );
      itemY += 18;
    }

    const fees: string[] = [];
    if (person.taxShare > 0) {
      fees.push(`Tax +${formatCurrency(person.taxShare, cur)}`);
    }
    if (person.serviceShare > 0) {
      fees.push(`Svc +${formatCurrency(person.serviceShare, cur)}`);
    }
    if (person.deliveryShare > 0) {
      fees.push(`Deliv +${formatCurrency(person.deliveryShare, cur)}`);
    }
    if (person.discountShare > 0) {
      fees.push(`Disc -${formatCurrency(person.discountShare, cur)}`);
    }
    if (fees.length > 0) {
      ctx.textAlign = "left";
      ctx.font = `500 10px ${mono}`;
      ctx.fillStyle = "#64748B";
      ctx.fillText(
        truncateText(ctx, fees.join("  ·  "), rightX - innerX),
        innerX,
        itemY + 2
      );
    }

    y += rowH + 10;
  });

  // Payment Info block
  if (showPayment && paymentInfo) {
    y += 2;
    drawRoundedRect(ctx, pad, y, width - pad * 2, paymentBlockHeight, 14);
    ctx.fillStyle = "#181E2A";
    ctx.fill();
    ctx.strokeStyle = "rgba(16,185,129,0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = `600 11px ${sans}`;
    ctx.fillStyle = "#34D399";
    ctx.fillText(
      payer ? `TRANSFER TO ${payer.name.toUpperCase()}` : "PAYMENT INFO",
      innerX,
      y + 24
    );

    const acctLine = [
      paymentInfo.provider.trim(),
      paymentInfo.accountNumber.trim(),
    ]
      .filter(Boolean)
      .join("  ·  ");
    ctx.font = `700 14px ${mono}`;
    ctx.fillStyle = "#F8FAFC";
    ctx.fillText(
      truncateText(ctx, acctLine || paymentInfo.accountName.trim(), rightX - innerX),
      innerX,
      y + 48
    );

    const subLine = [
      paymentInfo.accountName.trim() ? `a/n ${paymentInfo.accountName.trim()}` : "",
      paymentInfo.note.trim(),
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (subLine) {
      ctx.font = `400 11px ${sans}`;
      ctx.fillStyle = "#94A3B8";
      ctx.fillText(truncateText(ctx, subLine, rightX - innerX), innerX, y + 70);
    }

    y += paymentBlockHeight + 10;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.font = `500 11px ${sans}`;
  ctx.fillStyle = "#64748B";
  const footerNote =
    roundingStep > 0
      ? `Rounded up to nearest ${formatCurrency(roundingStep, cur)}  ·  BillSplitterW`
      : "Split with BillSplitterW";
  ctx.fillText(footerNote, width / 2, y + 24);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((out) => {
      if (!out) {
        reject(new Error("Could not export split image."));
        return;
      }
      resolve(out);
    }, "image/png");
  });

  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

/**
 * Generates and shares (mobile Web Share API) or downloads (desktop fallback)
 * the PNG split summary card.
 */
export async function shareOrDownloadSplitImage(
  options: SplitCardImageOptions
): Promise<"shared" | "downloaded"> {
  const blob = await generateSplitCardPng(options);
  const slugName = (options.merchantName.trim() || "split-bill")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const filename = `billsplitterw-${slugName || "summary"}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: options.merchantName.trim() || "Split Bill Summary",
        files: [file],
      });
      return "shared";
    } catch (err) {
      // User cancelled share sheet — don't force download on AbortError
      if (err instanceof DOMException && err.name === "AbortError") {
        return "shared";
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
