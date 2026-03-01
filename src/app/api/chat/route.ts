import { NextResponse } from "next/server"
import Groq from "groq-sdk"

export const runtime = "nodejs"

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

// Mode-specific system prompts
const MODE_PROMPTS = {
  "logic-breaker": `You are PetalMind in LOGIC BREAKER mode. Your job is to:
- Identify logical fallacies and weak arguments
- Point out inconsistencies and contradictions
- Challenge assumptions with counterexamples
- Show what actually makes sense vs what sounds good
- Be analytical and expose flaws in reasoning
- Keep responses concise and focused on logical analysis`,

  "brutal-honesty": `You are PetalMind in BRUTAL HONESTY mode. Your job is to:
- Give the unfiltered truth with zero sugarcoating
- Be direct and blunt
- Skip pleasantries
- Call things out as they are`,

  "deep-analyst": `You are PetalMind in DEEP ANALYST mode. Your job is to:
- Dissect problems precisely
- Reveal hidden patterns
- Break down complex issues structurally
- Provide deep insights`,

  "ego-slayer": `You are PetalMind in EGO SLAYER mode. Your job is to:
- Challenge comfortable beliefs
- Dismantle excuses
- Force uncomfortable growth`,

  "rapid-fire": `You are PetalMind in RAPID FIRE mode. Your job is to:
- Give fast, sharp answers
- Cut all fluff
- Keep responses extremely concise`
}

export async function POST(req: Request) {
  try {
    if (!groq) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY" },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { messages, stream, mode } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      )
    }

    const hasImageInput = messages.some(
      (m: any) => m.role === "user" && !!m.imageUrl
    )

    let systemPromptContent =
      mode && MODE_PROMPTS[mode]
        ? MODE_PROMPTS[mode]
        : "You are PetalMind, a direct and efficient AI assistant."

    const systemPrompt = {
      role: "system",
      content: systemPromptContent,
    }

    const streamToResponse = async (iterator: AsyncIterable<any>) => {
      const encoder = new TextEncoder()
      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const part of iterator as any) {
              const delta = part?.choices?.[0]?.delta?.content || ""
              if (delta) controller.enqueue(encoder.encode(delta))
            }
          } finally {
            controller.close()
          }
        },
      })
      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      })
    }

    // -------- IMAGE MODE (Groq Vision FREE) --------
    if (hasImageInput) {
      const latestMessage = messages[messages.length - 1]
      const imageUrl = latestMessage.imageUrl || ""

      const completion = await groq.chat.completions.create({
        model: "llama-3.2-90b-vision-preview",
        messages: [
          systemPrompt,
          {
            role: "user",
            content: [
              { type: "text", text: latestMessage.content },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ] as any,
        temperature: 0.7,
        max_tokens: 1024,
        stream: !!stream,
      })

      if (stream) {
        return streamToResponse(completion)
      }

      const reply =
        completion.choices?.[0]?.message?.content?.trim() ||
        "I couldn't analyze this image."

      return NextResponse.json({ reply })
    }

    // -------- TEXT MODE (Groq Only) --------

    const groqMessages = [systemPrompt, ...messages].map((m: any) => ({
      role: m.role,
      content: m.content,
    }))

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 1200,
      stream: !!stream,
    })

    if (stream) {
      return streamToResponse(completion)
    }

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I'm not sure how to respond."

    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error("/api/chat error", err)
    return NextResponse.json(
      { error: err?.message || "Unexpected error" },
      { status: 500 }
    )
  }
}
