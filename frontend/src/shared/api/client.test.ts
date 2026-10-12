import { afterEach, describe, expect, it, vi } from "vitest";
import { api, API_REQUEST_TIMEOUT_MS } from "./client";

describe("API 요청 시간 제한과 취소", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function stalledFetch() {
    const fetchMock = vi.fn(
      (_path: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal!;
          if (signal.aborted) reject(signal.reason);
          else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("시간 제한을 넘긴 요청을 일관된 API 오류로 표시한다", async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    const fetchMock = stalledFetch();
    const request = api("/assessments");
    const assertion = expect(request).rejects.toMatchObject({ status: 504, code: "request_timeout" });
    deadline.abort(new DOMException("timeout", "TimeoutError"));
    await assertion;
    expect(timeout).toHaveBeenCalledWith(API_REQUEST_TIMEOUT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("회사 변경으로 취소한 요청을 timeout 오류로 바꾸지 않는다", async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    stalledFetch();
    const caller = new AbortController();
    const cancellation = new DOMException("cancelled", "AbortError");
    const request = api("/assessments", { signal: caller.signal });
    const assertion = expect(request).rejects.toBe(cancellation);
    caller.abort(cancellation);
    await assertion;
  });
});
