import { Ladoo } from "../src/index.js";

export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: BodyInit | null | undefined;
}

type Handler = (req: RecordedRequest, attempt: number) => Response | Promise<Response>;

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

export function apiError(status: number, code: string, headers: Record<string, string> = {}): Response {
  return json(
    { error: { code, message: `demo ${code}`, request_id: "6b1f0c2e-9d4a-4f3b-8e7c-5a2d1b0c9e8f" } },
    { status, headers },
  );
}

/** A client whose fetch is answered by `handler`, with every request recorded. */
export function mockClient(handler: Handler, options: ConstructorParameters<typeof Ladoo>[0] = {}) {
  const requests: RecordedRequest[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const req: RecordedRequest = {
      method: init?.method ?? "GET",
      url: new URL(String(input)),
      headers: new Headers(init?.headers),
      body: init?.body,
    };
    requests.push(req);
    return handler(req, requests.length - 1);
  };
  const ladoo = new Ladoo({
    apiKey: "lsk_demo_test",
    maxRetries: 2,
    ...options,
    fetch: fetch as typeof globalThis.fetch,
  });
  return { ladoo, requests };
}
