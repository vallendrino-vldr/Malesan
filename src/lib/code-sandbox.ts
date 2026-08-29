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

export interface LessonChallenge {
  objective: string;
  starterCode: string;
  hint: string;
}

export function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .trim();
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

export function getLessonChallenge(level: number): LessonChallenge {
  switch (level) {
    case 1:
      return {
        objective: "Ubah nilai variabel saldo dari 0 menjadi angka 50000 (tanpa tanda kutip), lalu jalankan kode.",
        starterCode: `let saldo = 0;\n\nconsole.log("Saldo Gue:", saldo);`,
        hint: "Ganti angka 0 menjadi 50000 tanpa tanda kutip.",
      };
    case 2:
      return {
        objective: "Ganti 'var' menjadi 'const' untuk namaToko (karena tetap) dan 'let' untuk totalBelanja (karena bertambah).",
        starterCode: `var namaToko = "Warung Bu Sri";\nvar totalBelanja = 0;\n\ntotalBelanja = totalBelanja + 15000;\nconsole.log(namaToko, "Total:", totalBelanja);`,
        hint: "Ganti 'var' pertama jadi 'const', dan 'var' kedua jadi 'let'.",
      };
    case 3:
      return {
        objective: "Gunakan template literal (${nama}) di dalam backtick agar output mencetak: 'Halo Fadli, saldo lu 50000'.",
        starterCode: `let nama = "Fadli";\nlet saldo = 50000;\n\nconsole.log(\`Halo ..., saldo lu \${saldo}\`);`,
        hint: "Ganti tanda titik-titik (...) dengan ${nama}.",
      };
    case 4:
      return {
        objective: "Tulis kondisi 'saldo >= ongkir' di dalam kurung if agar pesanan diproses ketika saldo cukup.",
        starterCode: `let saldo = 10000;\nlet ongkir = 12000;\n\nif (saldo == 0) {\n  console.log("Pesanan diproses!");\n} else {\n  console.log("Saldo lu kurang, top up dulu bos.");\n}`,
        hint: "Ganti kondisi 'saldo == 0' menjadi 'saldo >= ongkir'.",
      };
    case 5:
      return {
        objective: "Perbaiki bug perbandingan di baris 4 menjadi '===' agar password yang salah ditolak (Password salah!).",
        starterCode: `let passwordAsli = "rahasia123";\nlet inputUser = "tebakngasal";\n\nif (passwordAsli = inputUser) {\n  console.log("Login sukses!");\n} else {\n  console.log("Password salah!");\n}`,
        hint: "Ganti tanda '=' tunggal di dalam if menjadi '===' (tiga sama dengan).",
      };
    case 6:
      return {
        objective: "Ambil item 'Es Teh' dari array keranjang (ingat index array dihitung mulai dari 0!).",
        starterCode: `let keranjang = ["Indomie", "Telur", "Es Teh", "Kerupuk"];\n\nlet pesanan = keranjang[0];\nconsole.log("Pesanan:", pesanan);`,
        hint: "Indomie = 0, Telur = 1, Es Teh = 2. Ganti angka di dalam kurung siku jadi 2.",
      };
    case 7:
      return {
        objective: "Tambahkan 'Kopi Sachet' ke paling belakang keranjang menggunakan method .push(\"Kopi Sachet\").",
        starterCode: `let keranjang = ["Indomie", "Telur"];\n\nkeranjang.pop();\n\nconsole.log(keranjang);`,
        hint: "Ganti 'keranjang.pop();' menjadi 'keranjang.push(\"Kopi Sachet\");'.",
      };
    case 8:
      return {
        objective: "Lengkapi kondisi loop dengan 'i < anakKos.length' agar mengabsen semua nama anak kos.",
        starterCode: `let anakKos = ["Budi", "Sinta", "Joko"];\n\nfor (let i = 0; i < 1; i++) {\n  console.log("Absen:", anakKos[i]);\n}`,
        hint: "Ganti kondisi 'i < 1' menjadi 'i < anakKos.length'.",
      };
    case 9:
      return {
        objective: "Tambahkan 'return total;' di dalam function agar nilainya keluar dan tercetak.",
        starterCode: `function hitungTotal(harga, pajak) {\n  let total = harga + pajak;\n}\n\nlet struk = hitungTotal(25000, 2000);\nconsole.log("Struk:", struk);`,
        hint: "Ketik 'return total;' sebelum kurung kurawal tutup function.",
      };
    case 10:
      return {
        objective: "Ubah spanduk.textContent menjadi 'Selamat Datang'.",
        starterCode: `let spanduk = { textContent: "Loading..." };\n\nspanduk.textContent = "Loading...";\nconsole.log("Spanduk:", spanduk.textContent);`,
        hint: "Ubah string menjadi: spanduk.textContent = \"Selamat Datang\";",
      };
    case 11:
      return {
        objective: "Lengkapi nama event listener 'click' agar tombol merespons saat dipencet.",
        starterCode: `let tombol = {\n  addEventListener: function(event, callback) {\n    if (event === "click") callback();\n  }\n};\n\ntombol.addEventListener("hover", () => {\n  console.log("Checkout diproses!");\n});`,
        hint: "Ganti event \"hover\" menjadi \"click\".",
      };
    case 12:
      return {
        objective: "Panggil e.preventDefault() di baris pertama callback submit agar form tidak refresh.",
        starterCode: `let form = {\n  submit: function(e, callback) { callback(e); }\n};\n\nlet fakeEvent = { defaultPrevented: false, preventDefault: function() { this.defaultPrevented = true; } };\n\nform.submit(fakeEvent, (e) => {\n  console.log("Status preventDefault:", e.defaultPrevented);\n});`,
        hint: "Ketik 'e.preventDefault();' di baris atas dalam function callback.",
      };
    default:
      return {
        objective: "Jalankan kode program dan pastikan menghasilkan output yang valid di terminal.",
        starterCode: `console.log("Misi Level ${level} siap dijalankan!");`,
        hint: "Pastikan kode dieksekusi tanpa error dan mencetak output ke terminal.",
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

  // Strip all comments before analyzing code keywords
  const cleanCode = stripComments(code);
  const allLogs = result.logs.join(" ").toLowerCase();

  switch (level) {
    case 1:
      if (cleanCode.includes('"50000"') || cleanCode.includes("'50000'")) {
        return {
          isValid: false,
          message: "Kamu memasukkan teks bertanda kutip (\"50000\").",
          hint: "Tulis angkanya polos tanpa tanda kutip: 50000.",
        };
      }
      if (allLogs.includes("50000")) {
        return {
          isValid: true,
          message: "Target tercapai! Variabel saldo berhasil bernilai angka 50000.",
        };
      }
      return {
        isValid: false,
        message: "Output belum mencetak angka 50000.",
        hint: "Ubah saldo menjadi 50000 (contoh: let saldo = 50000;).",
      };

    case 2:
      if (cleanCode.includes("var ")) {
        return {
          isValid: false,
          message: "Masih ada kata kunci 'var'.",
          hint: "Ganti 'var' pertama jadi 'const' dan 'var' kedua jadi 'let'.",
        };
      }
      if (cleanCode.includes("const namaToko") && cleanCode.includes("let totalBelanja")) {
        return {
          isValid: true,
          message: "Target tercapai! const dan let sudah terpasang dengan tepat.",
        };
      }
      return {
        isValid: false,
        message: "Gunakan 'const' untuk namaToko dan 'let' untuk totalBelanja.",
        hint: "Nama toko yang tetap pakai const, belanjaan yang berubah pakai let.",
      };

    case 3:
      if (cleanCode.includes("${nama}") && allLogs.includes("halo fadli")) {
        return {
          isValid: true,
          message: "Target tercapai! Template literal berhasil menggabungkan teks dan variabel.",
        };
      }
      return {
        isValid: false,
        message: "Belum menggunakan format template literal (${nama}).",
        hint: "Gunakan ${nama} di dalam backtick untuk menyisipkan variabel.",
      };

    case 4:
      if (
        (cleanCode.includes("saldo >= ongkir") || cleanCode.includes("saldo>=ongkir")) &&
        allLogs.includes("saldo lu kurang")
      ) {
        return {
          isValid: true,
          message: "Target tercapai! Logika satpam if/else berhasil mengecek kondisi.",
        };
      }
      return {
        isValid: false,
        message: "Kondisi if belum lengkap atau belum benar.",
        hint: "Tulis kondisi: saldo >= ongkir di dalam tanda kurung if.",
      };

    case 5:
      if (cleanCode.includes("===") && allLogs.includes("password salah")) {
        return {
          isValid: true,
          message: "Target tercapai! Bug perbandingan berhasil diperbaiki dengan operator strict equality (===).",
        };
      }
      return {
        isValid: false,
        message: "Password yang salah masih berhasil login!",
        hint: "Ganti operator '=' menjadi '===' di baris if.",
      };

    case 6:
      if (allLogs.includes("es teh") && cleanCode.includes("[2]")) {
        return {
          isValid: true,
          message: "Target tercapai! Kamu berhasil mengambil 'Es Teh' pada index 2.",
        };
      }
      return {
        isValid: false,
        message: "Index yang diambil belum tepat untuk 'Es Teh'.",
        hint: "Indomie=0, Telur=1, Es Teh=2. Gunakan keranjang[2].",
      };

    case 7:
      if (cleanCode.includes(".push(") && allLogs.includes("kopi sachet")) {
        return {
          isValid: true,
          message: "Target tercapai! Method .push() sukses menambahkan item ke ujung array.",
        };
      }
      return {
        isValid: false,
        message: "Belum menggunakan method .push(\"Kopi Sachet\").",
        hint: "Tulis keranjang.push(\"Kopi Sachet\");",
      };

    case 8:
      if (
        (cleanCode.includes("i < anakKos.length") ||
          cleanCode.includes("i<anakKos.length") ||
          cleanCode.includes("i < 3") ||
          cleanCode.includes("i <= 2")) &&
        allLogs.includes("budi") &&
        allLogs.includes("joko")
      ) {
        return {
          isValid: true,
          message: "Target tercapai! Loop berhasil mengabsen semua anak kos.",
        };
      }
      return {
        isValid: false,
        message: "Kondisi loop belum lengkap.",
        hint: "Gunakan 'i < anakKos.length' sebagai kondisi berhenti loop.",
      };

    case 9:
      if (cleanCode.includes("return total") && allLogs.includes("27000")) {
        return {
          isValid: true,
          message: "Target tercapai! Nilai total berhasil di-return dari dalam function.",
        };
      }
      return {
        isValid: false,
        message: "Hasil hitungan belum di-return dari function.",
        hint: "Tambahkan 'return total;' di dalam function sebelum kurung tutup.",
      };

    case 10:
      if (allLogs.includes("selamat datang")) {
        return {
          isValid: true,
          message: "Target tercapai! Properti textContent spanduk berhasil diperbarui.",
        };
      }
      return {
        isValid: false,
        message: "Teks spanduk belum berubah menjadi 'Selamat Datang'.",
        hint: "Isi spanduk.textContent = \"Selamat Datang\";",
      };

    case 11:
      if (cleanCode.includes('"click"') || cleanCode.includes("'click'")) {
        return {
          isValid: true,
          message: "Target tercapai! Event listener 'click' berhasil didaftarkan.",
        };
      }
      return {
        isValid: false,
        message: "Nama event belum 'click'.",
        hint: "Gunakan string \"click\" sebagai nama event.",
      };

    case 12:
      if (cleanCode.includes("e.preventDefault()") && allLogs.includes("true")) {
        return {
          isValid: true,
          message: "Target tercapai! e.preventDefault() berhasil dipanggil.",
        };
      }
      return {
        isValid: false,
        message: "e.preventDefault() belum dipanggil.",
        hint: "Tulis e.preventDefault(); di dalam callback function.",
      };

    default:
      if (result.logs.length > 0 || result.returnValue !== undefined) {
        return {
          isValid: true,
          message: "Target tercapai! Program berhasil dieksekusi dengan output valid.",
        };
      }
      return {
        isValid: false,
        message: "Kode berjalan tapi belum mencetak output apapun.",
        hint: "Gunakan console.log(...) untuk menampilkan hasil ke terminal.",
      };
  }
}
