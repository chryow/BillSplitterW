import { formatCurrency } from "./currency";
import { EDITORIAL_THEME } from "./theme";
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
 * Renders a crisp 2x retina Editorial E-Ink printed-receipt PNG summary card via HTML Canvas
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

  const { colors, fonts } = EDITORIAL_THEME;
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

  // Unbleached paper background
  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, width, totalHeight);

  const serif = fonts.serif;
  const sans = fonts.sans;
  const mono = fonts.mono;

  let y = pad;

  // Header ledger card
  drawRoundedRect(ctx, pad, y, width - pad * 2, headerHeight, 3);
  ctx.fillStyle = colors.surface;
  ctx.fill();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 1;
  ctx.stroke();

  const innerX = pad + cardPad;
  const rightX = width - pad - cardPad;

  ctx.font = `600 10px ${mono}`;
  ctx.fillStyle = colors.graphite;
  ctx.textAlign = "left";
  ctx.fillText(
    `SPLIT SUMMARY${dateLabel ? `  ·  ${dateLabel.toUpperCase()}` : ""}`,
    innerX,
    y + 24
  );

  ctx.font = `600 21px ${serif}`;
  ctx.fillStyle = colors.ink;
  ctx.fillText(
    truncateText(ctx, merchantName.trim() || "Split Bill", width - pad * 2 - 145),
    innerX,
    y + 53
  );

  // Grand total on right
  ctx.textAlign = "right";
  ctx.font = `600 10px ${mono}`;
  ctx.fillStyle = colors.graphite;
  ctx.fillText("GRAND TOTAL", rightX, y + 24);

  ctx.font = `700 18px ${mono}`;
  ctx.fillStyle = colors.vermilion;
  ctx.fillText(formatCurrency(split.grandTotal, cur), rightX, y + 53);

  // Hairline divider inside header
  ctx.strokeStyle = colors.hairline;
  ctx.beginPath();
  ctx.moveTo(innerX, y + 68);
  ctx.lineTo(rightX, y + 68);
  ctx.stroke();

  // Sub-meta row
  ctx.textAlign = "left";
  ctx.font = `500 10px ${mono}`;
  ctx.fillStyle = colors.graphite;
  const metaBits: string[] = [
    `ITEMS ${formatCurrency(split.itemsSubtotal, cur)}`,
  ];
  if (split.tax > 0) metaBits.push(`TAX ${formatCurrency(split.tax, cur)}`);
  if (split.serviceCharge > 0) {
    metaBits.push(`SVC ${formatCurrency(split.serviceCharge, cur)}`);
  }
  if (split.deliveryFee > 0) {
    metaBits.push(`DELIV ${formatCurrency(split.deliveryFee, cur)}`);
  }
  if (split.discount > 0) {
    metaBits.push(`DISC -${formatCurrency(split.discount, cur)}`);
  }
  ctx.fillText(
    truncateText(ctx, metaBits.join("  ·  "), rightX - innerX),
    innerX,
    y + 90
  );

  y += headerHeight + 14;

  // Per-person ledger cards
  split.people.forEach((person, idx) => {
    const rowH = personRowHeights[idx];
    const isPayer = payer?.participantId === person.participantId;
    const isSettled = !isPayer && settledSet.has(person.participantId);

    drawRoundedRect(ctx, pad, y, width - pad * 2, rowH, 3);
    ctx.fillStyle = isSettled ? colors.pressedPaper : colors.surface;
    ctx.fill();
    ctx.strokeStyle = isSettled ? colors.fountainGreen : colors.hairline;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Color dot
    ctx.beginPath();
    ctx.arc(innerX + 4, y + 22, 4, 0, Math.PI * 2);
    ctx.fillStyle = person.color;
    ctx.fill();

    // Name + status
    ctx.textAlign = "left";
    ctx.font = `600 14px ${sans}`;
    ctx.fillStyle = colors.ink;
    const statusSuffix = isPayer
      ? "  (Paid bill)"
      : isSettled
        ? "  ✓ Paid"
        : "";
    ctx.fillText(
      truncateText(ctx, `${person.name}${statusSuffix}`, rightX - innerX - 125),
      innerX + 16,
      y + 27
    );

    // Person total
    ctx.textAlign = "right";
    ctx.font = `700 15px ${mono}`;
    ctx.fillStyle = isSettled ? colors.fountainGreen : colors.ink;
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
      ctx.fillStyle = colors.graphite;
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
      ctx.fillStyle = colors.ink;
      ctx.fillText(formatCurrency(item.amount, cur), rightX, itemY);
      itemY += 18;
    }

    if (person.items.length > 4) {
      ctx.textAlign = "left";
      ctx.font = `400 11px ${sans}`;
      ctx.fillStyle = colors.graphite;
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
      ctx.fillStyle = colors.graphite;
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
    drawRoundedRect(ctx, pad, y, width - pad * 2, paymentBlockHeight, 3);
    ctx.fillStyle = colors.pressedPaper;
    ctx.fill();
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = `600 10px ${mono}`;
    ctx.fillStyle = colors.vermilion;
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
    ctx.fillStyle = colors.ink;
    ctx.fillText(
      truncateText(
        ctx,
        acctLine || paymentInfo.accountName.trim(),
        rightX - innerX
      ),
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
      ctx.fillStyle = colors.graphite;
      ctx.fillText(truncateText(ctx, subLine, rightX - innerX), innerX, y + 70);
    }

    y += paymentBlockHeight + 10;
  }

  // Editorial Colophon Footer
  ctx.strokeStyle = colors.hairline;
  ctx.beginPath();
  ctx.moveTo(pad, y + 8);
  ctx.lineTo(width - pad, y + 8);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = `500 9.5px ${mono}`;
  ctx.fillStyle = colors.graphite;
  const leftFooter =
    roundingStep > 0
      ? `ROUNDED ${formatCurrency(roundingStep, cur)} · BILLSPLITTERW`
      : `BILLSPLITTERW · ${EDITORIAL_THEME.version.toUpperCase()}`;
  ctx.fillText(leftFooter, pad, y + 27);

  ctx.textAlign = "right";
  ctx.fillStyle = colors.graphite;
  ctx.fillText(EDITORIAL_THEME.colophonLabel, width - pad - 10, y + 27);

  ctx.fillStyle = colors.vermilion;
  ctx.fillRect(width - pad - 5, y + 21, 5, 5);

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
