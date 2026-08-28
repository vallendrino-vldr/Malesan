"use client";

import React from "react";

interface GlossaryItem {
  term: string;
  pronunciation: string;
  analogy: string;
  example: string;
}

const GLOSSARY_ITEMS: GlossaryItem[] = [
  {
    term: "Variabel (let / const)",
    pronunciation: "va-ri-a-bel",
    analogy: "Toples atau laci berlabel buat nyimpen data (angka, nama, atau status) biar gampang dipanggil lagi.",
    example: "let saldo = 50000; // laci bernama saldo diisi 50rb",
  },
  {
    term: "String (Teks)",
    pronunciation: "string",
    analogy: "Deretan huruf/kata yang selalu dibungkus tanda kutip \"...\".",
    example: "let nama = \"Fadli\"; // teks wajib ada tanda kutip",
  },
  {
    term: "Boolean (Benar / Salah)",
    pronunciation: "bu-li-yan",
    analogy: "Saklar lampu — cuma punya dua kondisi: hidup (true) atau mati (false).",
    example: "let sudahLogin = true; // cuma true atau false",
  },
  {
    term: "If / Else (Kondisi)",
    pronunciation: "if els",
    analogy: "Satpam pemeriksa tiket: 'Kalo punya tiket, masuk. Kalo gak, beli dulu.'",
    example: "if (saldo >= 10000) { pesenKopi(); }",
  },
  {
    term: "Array (Daftar List)",
    pronunciation: "e-rey",
    analogy: "Keranjang belanja yang isinya banyak barang berurutan, dimulai dari nomor 0.",
    example: "let belanjaan = [\"Indomie\", \"Telur\", \"Kopi\"];",
  },
  {
    term: "Function (Fungsi / Resep)",
    pronunciation: "fang-shen",
    analogy: "Resep masak atau tombol blender: dipencet sekali, ngerjain serangkaian langkah otomatis.",
    example: "function bikinKopi() { rebusAir(); tuangKopi(); }",
  },
  {
    term: "DOM (Document Object Model)",
    pronunciation: "di-o-em",
    analogy: "Jembatan JavaScript ke layar: cara kode ngubah teks tombol, warna, atau gambar di website.",
    example: "document.querySelector(\"h1\").innerText = \"Halo Dunia\";",
  },
  {
    term: "API (Application Programming Interface)",
    pronunciation: "e-pi-ai",
    analogy: "Pelayan restoran: ngambil pesanan dari meja lu, bawa ke dapur (server), terus nganter makanannya balik ke lu.",
    example: "fetch(\"https://api.cuaca.com/jakarta\")",
  },
  {
    term: "Bug & Syntax Error",
    pronunciation: "bag / sin-taks",
    analogy: "Typo atau kesalahan tata bahasa yang bikin komputer bingung dan mogok jalan.",
    example: "Kurang tanda kurung ')' atau salah ketik nama variabel.",
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlossaryModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="surface-card w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-hairline/80 shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline/70 px-5 py-4 bg-surface/80">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-ember/15 border border-ember/30 text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-ink">Kamus Istilah Ngoding</h3>
              <p className="text-micro text-muted">Bahasa manusia untuk istilah komputer</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kamus"
            className="flex size-8 items-center justify-center rounded-lg border border-hairline bg-surface-raised/60 text-muted hover:text-ink hover:bg-surface-raised transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Terms List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
          {GLOSSARY_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-hairline/60 bg-surface-raised/40 p-3.5 hover:border-ember/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-display text-xs font-bold text-ember">{item.term}</span>
                <span className="text-[10px] font-mono text-muted/75 bg-surface px-2 py-0.5 rounded border border-hairline/40">
                  {item.pronunciation}
                </span>
              </div>
              <p className="text-xs text-ink/90 leading-relaxed mb-2">
                💡 <span className="text-muted">{item.analogy}</span>
              </p>
              <div className="rounded-lg bg-obsidian/90 border border-hairline/40 p-2 font-mono text-[11px] text-ember-lo overflow-x-auto">
                <code>{item.example}</code>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-hairline/70 px-5 py-3 bg-surface/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-lg bg-ember text-obsidian text-xs font-bold hover:bg-ember-lo transition-colors"
          >
            Paham, Balik Belajar
          </button>
        </div>
      </div>
    </div>
  );
}
