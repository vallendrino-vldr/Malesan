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

export function runJavaScriptSandbox(code: string, lang: "id" | "en" = "id"): SandboxResult {
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
      error:
        lang === "en"
          ? "Access to storage, network, or window is restricted for sandbox security."
          : "Akses ke storage, network, atau window dibatasi demi keamanan sandbox.",
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

export function getLessonChallenge(level: number, lang: "id" | "en" = "id"): LessonChallenge {
  if (lang === "en") {
    switch (level) {
      case 1:
        return {
          objective: "Change variable 'balance' from 0 to 50000 (without quotation marks), then run the code.",
          starterCode: `let balance = 0;\n\nconsole.log("My Balance:", balance);`,
          hint: "Replace number 0 with 50000 without quotation marks.",
        };
      case 2:
        return {
          objective: "Change 'var' to 'const' for storeName (constant) and 'let' for orderTotal (reassigned).",
          starterCode: `var storeName = "Corner Cafe";\nvar orderTotal = 0;\n\norderTotal = orderTotal + 15000;\nconsole.log(storeName, "Total:", orderTotal);`,
          hint: "Change first 'var' to 'const', and second 'var' to 'let'.",
        };
      case 3:
        return {
          objective: "Use template literal (${name}) inside backticks to print: 'Hello Alex, your balance is 50000'.",
          starterCode: `let name = "Alex";\nlet balance = 50000;\n\nconsole.log(\`Hello ..., your balance is \${balance}\`);`,
          hint: "Replace the dots (...) with ${name}.",
        };
      case 4:
        return {
          objective: "Write conditional 'balance >= fare' inside if parentheses so orders process when balance is sufficient.",
          starterCode: `let balance = 10000;\nlet fare = 12000;\n\nif (balance == 0) {\n  console.log("Order confirmed!");\n} else {\n  console.log("Insufficient balance, please top up.");\n}`,
          hint: "Change condition 'balance == 0' to 'balance >= fare'.",
        };
      case 5:
        return {
          objective: "Fix comparison bug on line 4 using '===' so invalid passwords are rejected (Wrong password!).",
          starterCode: `let actualPassword = "secret123";\nlet userInput = "randomguess";\n\nif (actualPassword = userInput) {\n  console.log("Login success!");\n} else {\n  console.log("Wrong password!");\n}`,
          hint: "Change single '=' inside if to strict '===' (triple equals).",
        };
      case 6:
        return {
          objective: "Retrieve 'Iced Tea' from cart array (remember zero-indexing starts at 0!).",
          starterCode: `let cart = ["Noodles", "Eggs", "Iced Tea", "Chips"];\n\nlet order = cart[0];\nconsole.log("Order:", order);`,
          hint: "Noodles = 0, Eggs = 1, Iced Tea = 2. Change bracket index to 2.",
        };
      case 7:
        return {
          objective: "Append 'Instant Coffee' to the back of the cart using method .push(\"Instant Coffee\").",
          starterCode: `let cart = ["Noodles", "Eggs"];\n\ncart.pop();\n\nconsole.log(cart);`,
          hint: "Change 'cart.pop();' to 'cart.push(\"Instant Coffee\");'.",
        };
      case 8:
        return {
          objective: "Complete loop condition with 'i < tenants.length' to log every tenant name.",
          starterCode: `let tenants = ["Alex", "Sam", "Jordan"];\n\nfor (let i = 0; i < 1; i++) {\n  console.log("Tenant:", tenants[i]);\n}`,
          hint: "Change condition 'i < 1' to 'i < tenants.length'.",
        };
      case 9:
        return {
          objective: "Add 'return total;' inside the function so the calculated sum is returned.",
          starterCode: `function calculateTotal(price, tax) {\n  let total = price + tax;\n}\n\nlet receipt = calculateTotal(25000, 2000);\nconsole.log("Receipt:", receipt);`,
          hint: "Type 'return total;' before the closing curly brace of the function.",
        };
      case 10:
        return {
          objective: "Change banner.textContent to 'Welcome'.",
          starterCode: `let banner = { textContent: "Loading..." };\n\nbanner.textContent = "Loading...";\nconsole.log("Banner:", banner.textContent);`,
          hint: "Update string to: banner.textContent = \"Welcome\";",
        };
      case 11:
        return {
          objective: "Complete event name 'click' so the button reacts when pressed.",
          starterCode: `let button = {\n  addEventListener: function(event, callback) {\n    if (event === "click") callback();\n  }\n};\n\nbutton.addEventListener("hover", () => {\n  console.log("Checkout processed!");\n});`,
          hint: "Change event \"hover\" to \"click\".",
        };
      case 12:
        return {
          objective: "Call e.preventDefault() on the first line of the submit callback to prevent form reloading.",
          starterCode: `let form = {\n  submit: function(e, callback) { callback(e); }\n};\n\nlet fakeEvent = { defaultPrevented: false, preventDefault: function() { this.defaultPrevented = true; } };\n\nform.submit(fakeEvent, (e) => {\n  console.log("Status preventDefault:", e.defaultPrevented);\n});`,
          hint: "Type 'e.preventDefault();' on the top line of the callback function.",
        };
      default:
        return {
          objective: "Run the program code and ensure valid console output is generated.",
          starterCode: `console.log("Mission Level ${level} ready to execute!");`,
          hint: "Ensure code executes without errors and prints output to terminal.",
        };
    }
  }

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
  result: SandboxResult,
  lang: "id" | "en" = "id"
): ValidationResult {
  const isEn = lang === "en";
  if (result.error) {
    return {
      isValid: false,
      message: isEn ? `Execution error: ${result.error}` : `Terjadi error: ${result.error}`,
      hint: isEn ? "Double check variable names, quotes, parentheses, or semicolons." : "Periksa kembali penulisan variabel, tanda kurung, atau titik koma.",
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
          message: isEn ? "You entered text in quotes (\"50000\")." : "Kamu memasukkan teks bertanda kutip (\"50000\").",
          hint: isEn ? "Write the raw number without quotation marks: 50000." : "Tulis angkanya polos tanpa tanda kutip: 50000.",
        };
      }
      if (allLogs.includes("50000")) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! The balance variable successfully holds the number 50000." : "Target tercapai! Variabel saldo berhasil bernilai angka 50000.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Output does not print the number 50000 yet." : "Output belum mencetak angka 50000.",
        hint: isEn ? "Set balance to 50000 (e.g. let balance = 50000;)." : "Ubah saldo menjadi 50000 (contoh: let saldo = 50000;).",
      };

    case 2:
      if (cleanCode.includes("var ")) {
        return {
          isValid: false,
          message: isEn ? "Keyword 'var' is still present." : "Masih ada kata kunci 'var'.",
          hint: isEn ? "Change first 'var' to 'const' and second 'var' to 'let'." : "Ganti 'var' pertama jadi 'const' dan 'var' kedua jadi 'let'.",
        };
      }
      if (
        (cleanCode.includes("const namaToko") || cleanCode.includes("const storeName")) &&
        (cleanCode.includes("let totalBelanja") || cleanCode.includes("let orderTotal"))
      ) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! const and let are appropriately configured." : "Target tercapai! const dan let sudah terpasang dengan tepat.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Use 'const' for constant store name and 'let' for dynamic total." : "Gunakan 'const' untuk namaToko dan 'let' untuk totalBelanja.",
        hint: isEn ? "Permanent names use const, changing totals use let." : "Nama toko yang tetap pakai const, belanjaan yang berubah pakai let.",
      };

    case 3:
      if ((cleanCode.includes("${nama}") || cleanCode.includes("${name}")) && (allLogs.includes("halo fadli") || allLogs.includes("hello alex"))) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! Template literal successfully interpolated variable and text." : "Target tercapai! Template literal berhasil menggabungkan teks dan variabel.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Not using the template literal syntax (${name})." : "Belum menggunakan format template literal (${nama}).",
        hint: isEn ? "Use ${name} inside backticks to interpolate the variable." : "Gunakan ${nama} di dalam backtick untuk menyisipkan variabel.",
      };

    case 4:
      if (
        (cleanCode.includes("saldo >= ongkir") ||
          cleanCode.includes("saldo>=ongkir") ||
          cleanCode.includes("balance >= fare") ||
          cleanCode.includes("balance>=fare")) &&
        (allLogs.includes("saldo lu kurang") || allLogs.includes("insufficient balance"))
      ) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! Guard conditional verified balance check." : "Target tercapai! Logika satpam if/else berhasil mengecek kondisi.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "The if condition is incomplete or inaccurate." : "Kondisi if belum lengkap atau belum benar.",
        hint: isEn ? "Write condition: balance >= fare inside the if parentheses." : "Tulis kondisi: saldo >= ongkir di dalam tanda kurung if.",
      };

    case 5:
      if (cleanCode.includes("===") && (allLogs.includes("password salah") || allLogs.includes("wrong password"))) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! Fixed comparison bug with strict equality (===)." : "Target tercapai! Bug perbandingan berhasil diperbaiki dengan operator strict equality (===).",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Invalid passwords are still allowed to log in!" : "Password yang salah masih berhasil login!",
        hint: isEn ? "Change '=' operator to '===' in the if statement." : "Ganti operator '=' menjadi '===' di baris if.",
      };

    case 6:
      if ((allLogs.includes("es teh") || allLogs.includes("iced tea")) && cleanCode.includes("[2]")) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! You correctly fetched item at index 2." : "Target tercapai! Kamu berhasil mengambil 'Es Teh' pada index 2.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Incorrect index retrieved for third item." : "Index yang diambil belum tepat untuk 'Es Teh'.",
        hint: isEn ? "First=0, Second=1, Third=2. Use cart[2]." : "Indomie=0, Telur=1, Es Teh=2. Gunakan keranjang[2].",
      };

    case 7:
      if (cleanCode.includes(".push(") && (allLogs.includes("kopi sachet") || allLogs.includes("instant coffee"))) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! Method .push() appended item to the array tail." : "Target tercapai! Method .push() sukses menambahkan item ke ujung array.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Did not use .push() with the new item." : "Belum menggunakan method .push(\"Kopi Sachet\").",
        hint: isEn ? "Write: cart.push(\"Instant Coffee\");" : "Tulis keranjang.push(\"Kopi Sachet\");",
      };

    case 8:
      if (
        (cleanCode.includes("i < anakKos.length") ||
          cleanCode.includes("i<anakKos.length") ||
          cleanCode.includes("i < tenants.length") ||
          cleanCode.includes("i<tenants.length") ||
          cleanCode.includes("i < 3") ||
          cleanCode.includes("i <= 2")) &&
        (allLogs.includes("budi") || allLogs.includes("alex")) &&
        (allLogs.includes("joko") || allLogs.includes("jordan"))
      ) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! Loop successfully logged all entries." : "Target tercapai! Loop berhasil mengabsen semua anak kos.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Loop condition incomplete." : "Kondisi loop belum lengkap.",
        hint: isEn ? "Use 'i < tenants.length' as the loop boundary condition." : "Gunakan 'i < anakKos.length' sebagai kondisi berhenti loop.",
      };

    case 9:
      if (cleanCode.includes("return total") && allLogs.includes("27000")) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! Total value was returned from the function." : "Target tercapai! Nilai total berhasil di-return dari dalam function.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Calculated sum was not returned from the function." : "Hasil hitungan belum di-return dari function.",
        hint: isEn ? "Add 'return total;' before the closing brace of the function." : "Tambahkan 'return total;' di dalam function sebelum kurung tutup.",
      };

    case 10:
      if (allLogs.includes("selamat datang") || allLogs.includes("welcome")) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! textContent property successfully updated." : "Target tercapai! Properti textContent spanduk berhasil diperbarui.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Banner text has not been updated." : "Teks spanduk belum berubah menjadi 'Selamat Datang'.",
        hint: isEn ? "Assign banner.textContent = \"Welcome\";" : "Isi spanduk.textContent = \"Selamat Datang\";",
      };

    case 11:
      if (cleanCode.includes('"click"') || cleanCode.includes("'click'")) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! Event listener 'click' registered." : "Target tercapai! Event listener 'click' berhasil didaftarkan.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Event name must be 'click'." : "Nama event belum 'click'.",
        hint: isEn ? "Use string \"click\" as the event name." : "Gunakan string \"click\" sebagai nama event.",
      };

    case 12:
      if (cleanCode.includes("e.preventDefault()") && allLogs.includes("true")) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! e.preventDefault() was invoked." : "Target tercapai! e.preventDefault() berhasil dipanggil.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "e.preventDefault() was not invoked." : "e.preventDefault() belum dipanggil.",
        hint: isEn ? "Write e.preventDefault(); inside the callback function." : "Tulis e.preventDefault(); di dalam callback function.",
      };

    default:
      if (result.logs.length > 0 || result.returnValue !== undefined) {
        return {
          isValid: true,
          message: isEn ? "Goal reached! Code executed with valid output." : "Target tercapai! Program berhasil dieksekusi dengan output valid.",
        };
      }
      return {
        isValid: false,
        message: isEn ? "Code ran but did not log any output." : "Kode berjalan tapi belum mencetak output apapun.",
        hint: isEn ? "Use console.log(...) to print outputs to the terminal." : "Gunakan console.log(...) untuk menampilkan hasil ke terminal.",
      };
  }
}
