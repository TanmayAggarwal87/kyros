import { NextResponse } from "next/server";
import { DEMO_WORKFLOW, DEMO_PLAN } from "@/lib/fixtures";

export async function GET() {
  return NextResponse.json({
    workflows: [DEMO_WORKFLOW],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt string is required" },
        { status: 400 }
      );
    }

    const workflowId = `wf-${Date.now().toString(36)}`;
    const runId = `run-${Date.now().toString(36)}`;

    return NextResponse.json({
      workflow: {
        ...DEMO_WORKFLOW,
        id: workflowId,
        runId,
        prompt,
        status: "ready",
      },
      plan: DEMO_PLAN,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
