export interface SandboxResult {
  logs: string[];
  error: string | null;
  returnValue: unknown;
  executionTimeMs: number;
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
  hint?: string;
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

export function validateLessonCode(
  level: number,
  code: string,
  result: SandboxResult
): ValidationResult {
  if (result.error) {
    return {
      isValid: false,
      message: `Terjadi error: ${result.error}`,
      hint: "Periksa kembali penulisan variabel, tanda kurung, atau titik koma.",
    };
  }

  const cleanCode = code.trim();
  const allLogs = result.logs.join(" ").toLowerCase();

  switch (level) {
    case 1:
      // Level 1: saldo = 50000 (number)
      if (allLogs.includes("50000")) {
        return {
          isValid: true,
          message: "Target tercapai! Variabel saldo berhasil mencetak angka 50000 ke terminal.",
        };
      }
      return {
        isValid: false,
        message: "Output belum mencetak angka 50000.",
        hint: "Pastikan variabel saldo diisi angka 50000 tanpa tanda kutip lalu cetak dengan console.log(saldo).",
      };

    case 2:
      // Level 2: const & let
      if (cleanCode.includes("const") && cleanCode.includes("let")) {
        return {
          isValid: true,
          message: "Target tercapai! Nama toko terkunci dengan const dan total belanja dinamis dengan let.",
        };
      }
      return {
        isValid: false,
        message: "Gunakan 'const' untuk namaToko dan 'let' untuk totalBelanja.",
        hint: "Nama toko yang tetap pakai const, belanjaan yang berubah pakai let.",
      };

    case 3:
      // Level 3: Template literal
      if (cleanCode.includes("`") && cleanCode.includes("${")) {
        return {
          isValid: true,
          message: "Target tercapai! String template literal berhasil menggabungkan teks dan variabel.",
        };
      }
      return {
        isValid: false,
        message: "Belum menggunakan format template literal (${...}).",
        hint: "Gunakan tanda backtick (`) dan ${namaVariabel} di dalam kalimat.",
      };

    case 4:
      // Level 4: If/Else
      if (cleanCode.includes("if") && cleanCode.includes("else")) {
        return {
          isValid: true,
          message: "Target tercapai! Logika satpam if/else berhasil mengecek kondisi.",
        };
      }
      return {
        isValid: false,
        message: "Struktur if/else belum lengkap.",
        hint: "Gunakan if (kondisi) { ... } else { ... }.",
      };

    case 5:
      // Level 5: === comparison
      if (cleanCode.includes("===")) {
        return {
          isValid: true,
          message: "Target tercapai! Operator perbandingan ketat (===) berhasil mencegah bug.",
        };
      }
      return {
        isValid: false,
        message: "Gunakan operator perbandingan '===' di dalam kondisi if.",
        hint: "Ganti '=' menjadi '===' agar tidak menimpa nilai variabel asli.",
      };

    default:
      // General fallback: Valid if code ran cleanly and produced logs or output
      if (result.logs.length > 0 || result.returnValue !== undefined) {
        return {
          isValid: true,
          message: "Target tercapai! Kode program berhasil dieksekusi dengan output yang valid.",
        };
      }
      return {
        isValid: false,
        message: "Kode berjalan tapi belum mencetak output apapun.",
        hint: "Gunakan console.log(...) untuk menampilkan hasil ke terminal.",
      };
  }
}
