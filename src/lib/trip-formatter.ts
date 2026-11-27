import { formatCurrency } from "./currency";
import type { Trip, TripCalculationResult, TripTransfer } from "./types";
import { hasPaymentInfo } from "./whatsapp-formatter";

export function formatTripTransferNudge(options: {
  tripName: string;
  currency: Trip["currency"];
  transfer: TripTransfer;
  shareUrl?: string | null;
}): string {
  const { tripName, currency, transfer, shareUrl } = options;
  const lines: string[] = [];

  lines.push(
    `Hi ${transfer.fromName}! For *${tripName}*, your settlement is *${formatCurrency(transfer.amount, currency)}* to *${transfer.toName}*.`
  );

  if (hasPaymentInfo(transfer.toPaymentInfo) && transfer.toPaymentInfo) {
    lines.push("");
    lines.push(`💳 *Transfer to ${transfer.toName}:*`);
    const acct = [
      transfer.toPaymentInfo.provider.trim(),
      transfer.toPaymentInfo.accountNumber.trim(),
    ]
      .filter(Boolean)
      .join(" · ");
    if (acct) lines.push(acct);
    if (transfer.toPaymentInfo.accountName.trim()) {
      lines.push(`a/n ${transfer.toPaymentInfo.accountName.trim()}`);
    }
    if (transfer.toPaymentInfo.note.trim()) {
      lines.push(transfer.toPaymentInfo.note.trim());
    }
  }

  if (shareUrl) {
    lines.push("");
    lines.push(`🔗 Trip breakdown: ${shareUrl}`);
  }

  return lines.join("\n").trim();
}

export function formatTripWhatsAppSummary(options: {
  trip: Trip;
  calc: TripCalculationResult;
  shareUrl?: string | null;
}): string {
  const { trip, calc, shareUrl } = options;
  const cur = calc.currency;
  const settledSet = new Set(trip.settledTransferKeys);

  const lines: string[] = [];
  lines.push(`✈️ *${trip.name}*`);
  lines.push(
    `Total Spend: *${formatCurrency(calc.totalSpend, cur)}* (${trip.expenses.length} bill${trip.expenses.length === 1 ? "" : "s"})`
  );
  lines.push("");

  if (calc.transfers.length === 0) {
    lines.push("✅ Everyone is already settled up!");
    lines.push("");
  } else {
    lines.push("💸 *Settle Up (Minimum Transfers)*");
    for (const transfer of calc.transfers) {
      const done = settledSet.has(transfer.key);
      lines.push(
        `• *${transfer.fromName}* → *${transfer.toName}*: *${formatCurrency(transfer.amount, cur)}*${done ? " ✅" : ""}`
      );
      if (hasPaymentInfo(transfer.toPaymentInfo) && transfer.toPaymentInfo) {
        const acct = [
          transfer.toPaymentInfo.provider.trim(),
          transfer.toPaymentInfo.accountNumber.trim(),
          transfer.toPaymentInfo.accountName.trim()
            ? `a/n ${transfer.toPaymentInfo.accountName.trim()}`
            : "",
        ]
          .filter(Boolean)
          .join(" · ");
        if (acct) {
          lines.push(`  _↳ ${acct}_`);
        }
      }
    }
    lines.push("");
  }

  lines.push("📊 *Trip Balances*");
  for (const bal of calc.balances) {
    const sign = bal.netBalance > 0 ? "+" : "";
    lines.push(
      `• ${bal.name}: paid ${formatCurrency(bal.totalPaid, cur)} · share ${formatCurrency(bal.totalShare, cur)} (${sign}${formatCurrency(bal.netBalance, cur)})`
    );
  }
  lines.push("");

  if (shareUrl) {
    lines.push(`🔗 Full trip breakdown: ${shareUrl}`);
    lines.push("");
  }

  lines.push("_Split with BillSplitterW_");
  return lines.join("\n").trim();
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
  let res = text;
  while (res.length > 1 && ctx.measureText(`${res}…`).width > maxWidth) {
    res = res.slice(0, -1);
  }
  return `${res}…`;
}

/**
 * Exports a crisp 2x dark-mode PNG Trip Settlement Card (Web Share on mobile, download on desktop).
 */
export async function shareOrDownloadTripCardImage(options: {
  trip: Trip;
  calc: TripCalculationResult;
}): Promise<"shared" | "downloaded"> {
  const { trip, calc } = options;
  const cur = calc.currency;
  const settledSet = new Set(trip.settledTransferKeys);

  const width = 440;
  const pad = 24;
  const cardPad = 16;
  const headerH = 98;
  const transferRowHeights = calc.transfers.map((t) =>
    hasPaymentInfo(t.toPaymentInfo) ? 62 : 44
  );
  const transfersH =
    calc.transfers.length > 0
      ? 26 + transferRowHeights.reduce((sum, h) => sum + h + 8, 0)
      : 54;
  const balancesH = 26 + calc.balances.length * 34 + 14;
  const footerH = 40;
  const totalHeight =
    pad + headerH + 14 + transfersH + 12 + balancesH + footerH + pad;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");

  ctx.scale(scale, scale);
  ctx.fillStyle = "#0A0D12";
  ctx.fillRect(0, 0, width, totalHeight);

  const sans =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

  const innerX = pad + cardPad;
  const rightX = width - pad - cardPad;
  let y = pad;

  // Header
  drawRoundedRect(ctx, pad, y, width - pad * 2, headerH, 16);
  ctx.fillStyle = "#12161F";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = `600 11px ${sans}`;
  ctx.fillStyle = "#34D399";
  ctx.fillText(
    `TRIP SUMMARY  ·  ${trip.expenses.length} BILL${trip.expenses.length === 1 ? "" : "S"}`,
    innerX,
    y + 24
  );

  ctx.font = `700 20px ${sans}`;
  ctx.fillStyle = "#F8FAFC";
  ctx.fillText(
    truncateText(ctx, trip.name, width - pad * 2 - 145),
    innerX,
    y + 54
  );

  ctx.textAlign = "right";
  ctx.font = `500 11px ${sans}`;
  ctx.fillStyle = "#94A3B8";
  ctx.fillText("TOTAL SPEND", rightX, y + 24);

  ctx.font = `700 18px ${mono}`;
  ctx.fillStyle = "#34D399";
  ctx.fillText(formatCurrency(calc.totalSpend, cur), rightX, y + 54);

  ctx.textAlign = "left";
  ctx.font = `400 11px ${sans}`;
  ctx.fillStyle = "#94A3B8";
  ctx.fillText(
    truncateText(
      ctx,
      `Crew: ${trip.members.map((m) => m.name).join(", ")}`,
      rightX - innerX
    ),
    innerX,
    y + 80
  );

  y += headerH + 16;

  // Transfers
  ctx.font = `600 11px ${sans}`;
  ctx.fillStyle = "#94A3B8";
  ctx.fillText("SETTLE UP (MINIMUM TRANSFERS)", pad + 2, y + 12);
  y += 22;

  if (calc.transfers.length === 0) {
    drawRoundedRect(ctx, pad, y, width - pad * 2, 42, 12);
    ctx.fillStyle = "#12161F";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = `600 13px ${sans}`;
    ctx.fillStyle = "#34D399";
    ctx.fillText("Everyone is settled up ✓", width / 2, y + 26);
    y += 50;
  } else {
    calc.transfers.forEach((transfer, idx) => {
      const h = transferRowHeights[idx];
      const settled = settledSet.has(transfer.key);
      drawRoundedRect(ctx, pad, y, width - pad * 2, h, 14);
      ctx.fillStyle = "#12161F";
      ctx.fill();
      ctx.strokeStyle = settled
        ? "rgba(16,185,129,0.35)"
        : "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.font = `600 13px ${sans}`;
      ctx.fillStyle = "#F8FAFC";
      ctx.fillText(
        truncateText(
          ctx,
          `${transfer.fromName}  →  ${transfer.toName}${settled ? "  ✓ Paid" : ""}`,
          rightX - innerX - 115
        ),
        innerX,
        y + 27
      );

      ctx.textAlign = "right";
      ctx.font = `700 14px ${mono}`;
      ctx.fillStyle = settled ? "#64748B" : "#34D399";
      ctx.fillText(formatCurrency(transfer.amount, cur), rightX, y + 27);

      if (hasPaymentInfo(transfer.toPaymentInfo) && transfer.toPaymentInfo) {
        const acct = [
          transfer.toPaymentInfo.provider.trim(),
          transfer.toPaymentInfo.accountNumber.trim(),
          transfer.toPaymentInfo.accountName.trim()
            ? `a/n ${transfer.toPaymentInfo.accountName.trim()}`
            : "",
        ]
          .filter(Boolean)
          .join(" · ");
        ctx.textAlign = "left";
        ctx.font = `400 11px ${mono}`;
        ctx.fillStyle = "#94A3B8";
        ctx.fillText(truncateText(ctx, acct, rightX - innerX), innerX, y + 48);
      }

      y += h + 8;
    });
  }

  y += 10;

  // Member balances summary box
  ctx.textAlign = "left";
  ctx.font = `600 11px ${sans}`;
  ctx.fillStyle = "#94A3B8";
  ctx.fillText("MEMBER BALANCES", pad + 2, y + 12);
  y += 22;

  const boxH = calc.balances.length * 34 + 12;
  drawRoundedRect(ctx, pad, y, width - pad * 2, boxH, 14);
  ctx.fillStyle = "#12161F";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();

  let rowY = y + 26;
  for (const bal of calc.balances) {
    ctx.beginPath();
    ctx.arc(innerX + 4, rowY - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = bal.color;
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = `600 12px ${sans}`;
    ctx.fillStyle = "#F8FAFC";
    ctx.fillText(truncateText(ctx, bal.name, 130), innerX + 16, rowY);

    ctx.textAlign = "right";
    ctx.font = `600 12px ${mono}`;
    ctx.fillStyle =
      bal.netBalance > 0
        ? "#34D399"
        : bal.netBalance < 0
          ? "#FBBF24"
          : "#94A3B8";
    const sign = bal.netBalance > 0 ? "+" : "";
    ctx.fillText(`${sign}${formatCurrency(bal.netBalance, cur)}`, rightX, rowY);
    rowY += 34;
  }

  y += boxH + 8;
  ctx.textAlign = "center";
  ctx.font = `500 11px ${sans}`;
  ctx.fillStyle = "#64748B";
  ctx.fillText("Split with BillSplitterW", width / 2, y + 22);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((out) => {
      if (!out) {
        reject(new Error("Failed to export trip image."));
        return;
      }
      resolve(out);
    }, "image/png");
  });

  canvas.width = 0;
  canvas.height = 0;

  const slugName = trip.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const filename = `billsplitterw-trip-${slugName || "summary"}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ title: `${trip.name} — Trip Split`, files: [file] });
      return "shared";
    } catch (err) {
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
