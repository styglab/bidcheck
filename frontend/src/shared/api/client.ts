export const API_REQUEST_TIMEOUT_MS = 140_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const deadline = AbortSignal.timeout(API_REQUEST_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  try {
    const response = await fetch(`/api/v1${path}`, {
      ...init,
      signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const detail = body.detail ?? body;
      throw new ApiError(
        response.status,
        detail.code ?? "request_failed",
        detail.message ?? "요청을 처리하지 못했습니다.",
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    // Cancellation on entity changes must remain a query cancellation, not an error.
    if (!init?.signal?.aborted && deadline.aborted) {
      throw new ApiError(
        504,
        "request_timeout",
        "데이터 조회 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
    throw error;
  }
}
