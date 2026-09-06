import fs from "fs";
import path from "path";

const indonesianWords = [
  "bikin", "naskah", "simpan", "hapus", "salin", "unduh", "memuat", "sedang",
  "wajib", "opsional", "selesai", "lanjut", "kembali", "durasi", "detik", "menit",
  "judul", "deskripsi", "kategori", "gaya", "suara", "pengaturan", "bantuan",
  "keluar", "masuk", "unggah", "bagikan", "tautan", "tutup", "batal", "gagal", "berhasil",
  "kredit", "kreator", "kalender", "jadwal", "tahap", "opsi"
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith(".tsx")) {
      results.push(full);
    }
  });
  return results;
}

const files = walk("./src/components");
const report = [];

files.forEach(file => {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  const matches = [];
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("import ")) return;
    
    for (const w of indonesianWords) {
      const regex = new RegExp(`[>"'\`][^<>"'\`]*\\b${w}\\b[^<>"'\`]*[<"'/\`]`, "i");
      if (regex.test(line)) {
        if (!line.includes("isEn") && !line.includes("language") && !line.includes("dict.") && !line.includes("t(")) {
          matches.push({ line: idx + 1, text: trimmed });
          break;
        }
      }
    }
  });
  
  if (matches.length > 0) {
    report.push({ file, matches });
  }
});

report.forEach(r => {
  console.log(`\n=== ${r.file} (${r.matches.length} matches) ===`);
  r.matches.slice(0, 8).forEach(m => {
    console.log(`  L${m.line}: ${m.text.substring(0, 100)}`);
  });
  if (r.matches.length > 8) {
    console.log(`  ... and ${r.matches.length - 8} more`);
  }
});
