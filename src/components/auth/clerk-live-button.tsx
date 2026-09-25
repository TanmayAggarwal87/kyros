"use client";

import React from "react";
import { SignInButton, UserButton, Show } from "@clerk/nextjs";
import { GoogleLogo } from "./google-logo";
import { Button } from "@/components/ui/button";

export function ClerkLiveButton() {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-in">
        <UserButton />
      </Show>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button
            size="sm"
            className="gap-2 h-8 px-3 rounded-xl text-xs bg-card hover:bg-muted text-foreground border border-border shadow-xs font-medium cursor-pointer"
          >
            <GoogleLogo className="size-3.5" />
            <span>Sign in with Google</span>
            <span className="text-[10px] text-muted-foreground/80 font-mono hidden sm:inline">Clerk</span>
          </Button>
        </SignInButton>
      </Show>
    </div>
  );
}
