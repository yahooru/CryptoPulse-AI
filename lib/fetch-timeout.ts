export class UpstreamTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms.`)
    this.name = "UpstreamTimeoutError"
  }
}

type FetchWithTimeoutInit = RequestInit & {
  next?: {
    revalidate?: number | false
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {},
  timeoutMs = 12_000,
  label = "Upstream request",
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new UpstreamTimeoutError(label, timeoutMs)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
