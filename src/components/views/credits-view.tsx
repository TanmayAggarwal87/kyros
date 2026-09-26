"use client";

import React, { useState } from "react";
import {
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UserCreditAccount, CreditLedgerEntry } from "@/core/contracts";

interface CreditsViewProps {
  creditAccount: UserCreditAccount;
  ledgerEntries: CreditLedgerEntry[];
  creditsStatus: "live" | "unavailable";
}

export function CreditsView({ creditAccount, ledgerEntries, creditsStatus }: CreditsViewProps) {
  const [topUpAmount, setTopUpAmount] = useState<number>(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const handleTopUp = async () => {
    setIsProcessing(true);
    setErrorNotice(null);
    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: topUpAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorNotice(typeof data.error === 'string' ? data.error : 'Checkout is unavailable');
        return;
      }
      if (typeof data.checkoutUrl === 'string') {
        window.location.href = data.checkoutUrl;
        return;
      }
      setErrorNotice('Checkout did not return a valid URL');
    } catch {
      setErrorNotice('Could not contact Checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  const getLedgerTypeBadge = (type: string) => {
    switch (type) {
      case "welcome_grant":
        return <Badge variant="success" className="text-[10px]">Welcome Credit</Badge>;
      case "stripe_topup":
        return <Badge variant="success" className="text-[10px]">Stripe Top-Up</Badge>;
      case "workflow_reservation":
        return <Badge variant="outline" className="text-[10px] text-amber-500">Reserved</Badge>;
      case "workflow_release":
        return <Badge variant="success" className="text-[10px]">Released</Badge>;
      case "x402_debit":
        return <Badge variant="inferred" className="text-[10px]">x402 Micropayment</Badge>;
      case "refund":
        return <Badge variant="success" className="text-[10px]">Refund</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-border/70 pb-4">
        <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
          Account Balance
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
          Research Credits & Ledger
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Research credits govern search and verified x402 telemetry without requiring web3 wallets.
        </p>
      </div>

      {/* Credit Balances Card */}
      <div className="p-6 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Available Research Balance
            </div>
            <div className="text-4xl font-extrabold text-foreground font-mono flex items-center gap-2 mt-1">
              <Coins className="size-7 text-amber-500 shrink-0" />
              <span>{creditsStatus === "live" ? `$${creditAccount.availableUsd.toFixed(2)}` : "Unavailable"}</span>
              {creditsStatus === "live" && <span className="text-sm font-normal text-muted-foreground">USD</span>}
            </div>
            <div className={`text-xs text-muted-foreground mt-1 ${creditsStatus === "live" ? "" : "hidden"}`}>
              Reserved in active runs: ${creditAccount.reservedUsd.toFixed(2)} • Total balance: ${creditAccount.balanceUsd.toFixed(2)}
            </div>
          </div>

          {/* Quick Add Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[10, 25, 50].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setTopUpAmount(amt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  topUpAmount === amt
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-foreground border-border/80 hover:bg-muted"
                }`}
              >
                + ${amt}
              </button>
            ))}

            <Button
              onClick={handleTopUp}
              disabled={isProcessing || creditsStatus !== "live"}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-600/20"
            >
              {isProcessing ? "Processing..." : `Add $${topUpAmount} via Stripe`}
            </Button>
          </div>
        </div>

        {errorNotice && <p role="alert" className="text-xs text-red-400">{errorNotice}</p>}
      </div>

      {/* Credit Ledger Table */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden space-y-0">
        <div className="p-4 border-b border-border/70 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Spending & Top-Up History
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {ledgerEntries.length} Transactions
          </span>
        </div>

        <Table>
          <TableHeader className="bg-muted/30 border-b border-border">
            <TableRow>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs text-right">Amount (USD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledgerEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                  No credit transactions recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              ledgerEntries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{getLedgerTypeBadge(entry.type)}</TableCell>
                  <TableCell className="text-xs text-foreground max-w-[280px] truncate" title={entry.description}>
                    {entry.description}
                  </TableCell>
                  <TableCell
                    className={`font-mono text-xs font-semibold text-right ${
                      entry.amountUsd >= 0
                        ? "text-emerald-500"
                        : "text-foreground"
                    }`}
                  >
                    {entry.amountUsd >= 0
                      ? `+$${entry.amountUsd.toFixed(2)}`
                      : `-$${Math.abs(entry.amountUsd).toFixed(3)}`}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
