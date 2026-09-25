"use client";

import { ClerkLiveButton } from './clerk-live-button';

export function ClerkUserButton() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <span className="text-xs text-muted-foreground">Sign-in unavailable: configure Clerk</span>;
  }
  return <ClerkLiveButton />;
}
