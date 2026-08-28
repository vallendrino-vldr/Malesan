export interface SandboxResult {
  logs: string[];
  error: string | null;
  returnValue: unknown;
  executionTimeMs: number;
}

export function runJavaScriptSandbox(code: string): SandboxResult {
  const logs: string[] = [];
  const start = performance.now();

  // Basic security sanitization: block dangerous globals
  if (
    code.includes("window.location") ||
    code.includes("document.cookie") ||
    code.includes("localStorage") ||
    code.includes("sessionStorage") ||
    code.includes("fetch(") ||
    code.includes("XMLHttpRequest")
  ) {
    return {
      logs: [],
      error: "Akses ke storage, network, atau window dibatasi demi keamanan sandbox.",
      returnValue: undefined,
      executionTimeMs: 0,
    };
  }

  try {
    // Custom log interceptor
    const customConsole = {
      log: (...args: unknown[]) => {
        logs.push(
          args
            .map((arg) => {
              if (typeof arg === "object" && arg !== null) {
                try {
                  return JSON.stringify(arg, null, 2);
                } catch {
                  return String(arg);
                }
              }
              return String(arg);
            })
            .join(" ")
        );
      },
      warn: (...args: unknown[]) => {
        logs.push("[WARN] " + args.map(String).join(" "));
      },
      error: (...args: unknown[]) => {
        logs.push("[ERROR] " + args.map(String).join(" "));
      },
    };

    // Execute within Function sandbox
    const runFn = new Function("console", `"use strict";\n${code}`);
    const returnValue = runFn(customConsole);
    const end = performance.now();

    return {
      logs,
      error: null,
      returnValue,
      executionTimeMs: Math.round((end - start) * 100) / 100,
    };
  } catch (err: unknown) {
    const end = performance.now();
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      logs,
      error: errorMessage,
      returnValue: undefined,
      executionTimeMs: Math.round((end - start) * 100) / 100,
    };
  }
}
