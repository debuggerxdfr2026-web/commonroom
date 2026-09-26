import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export type ApiRouteContext = { params: Promise<Record<string, string>> };
type RequestHandler = (request: NextRequest) => Promise<NextResponse>;
type ContextHandler = (request: NextRequest, context: ApiRouteContext) => Promise<NextResponse>;

export function withApiErrors(handler: RequestHandler): RequestHandler;
export function withApiErrors(handler: ContextHandler): ContextHandler;
export function withApiErrors(handler: RequestHandler | ContextHandler): RequestHandler | ContextHandler {
  return async (request: NextRequest, context?: ApiRouteContext) => {
    try {
      const response = context
        ? await (handler as ContextHandler)(request, context)
        : await (handler as RequestHandler)(request);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      console.error(`[api:${request.method} ${new URL(request.url).pathname}]`, error);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}

export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T extends z.ZodType>(
  request: NextRequest,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: errorResponse("Request body must be valid JSON.", 400) };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Please check the submitted information." },
        { status: 400 },
      ),
    };
  }
  return { data: result.data };
}

export function requireId(value: string | undefined): string | null {
  return value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : null;
}
