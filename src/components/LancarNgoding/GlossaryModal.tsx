"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface GlossaryItem {
  term: string;
  pronunciation: string;
  analogy: string;
  example: string;
}

const GLOSSARY_ITEMS_ID: GlossaryItem[] = [
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

const GLOSSARY_ITEMS_EN: GlossaryItem[] = [
  {
    term: "Variable (let / const)",
    pronunciation: "vair-ee-uh-buhl",
    analogy: "A labeled container or drawer for storing data (numbers, text, or status) so it's easy to retrieve later.",
    example: "let balance = 50; // drawer named balance stores 50",
  },
  {
    term: "String (Text)",
    pronunciation: "string",
    analogy: "A sequence of letters/words always enclosed within quotation marks \"...\".",
    example: "let name = \"Alex\"; // text must be enclosed in quotes",
  },
  {
    term: "Boolean (True / False)",
    pronunciation: "boo-lee-uhn",
    analogy: "A light switch — only two possible states: on (true) or off (false).",
    example: "let isLoggedIn = true; // only true or false",
  },
  {
    term: "If / Else (Conditions)",
    pronunciation: "if els",
    analogy: "A ticket inspector: 'If you hold a ticket, enter. Otherwise, purchase one first.'",
    example: "if (balance >= 10) { orderCoffee(); }",
  },
  {
    term: "Array (Ordered List)",
    pronunciation: "uh-ray",
    analogy: "A shopping cart holding multiple items in sequential order, starting from index 0.",
    example: "let cart = [\"Coffee\", \"Bagel\", \"Water\"];",
  },
  {
    term: "Function (Recipe / Routine)",
    pronunciation: "fuhngk-shn",
    analogy: "A recipe or appliance button: pressed once, it runs a sequence of automated steps.",
    example: "function makeCoffee() { boilWater(); pourCoffee(); }",
  },
  {
    term: "DOM (Document Object Model)",
    pronunciation: "dee-oh-em",
    analogy: "JavaScript's bridge to the browser UI: how code modifies text, styles, or elements on a page.",
    example: "document.querySelector(\"h1\").innerText = \"Hello World\";",
  },
  {
    term: "API (Application Programming Interface)",
    pronunciation: "ay-pee-eye",
    analogy: "A restaurant server: takes your table's order, brings it to the kitchen (server), and returns with your food.",
    example: "fetch(\"https://api.weather.com/forecast\")",
  },
  {
    term: "Bug & Syntax Error",
    pronunciation: "buhg / sin-taks",
    analogy: "A typo or grammatical error that confuses the computer and prevents execution.",
    example: "Missing closing bracket ')' or misspelling a variable identifier.",
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlossaryModal({ isOpen, onClose }: Props) {
  const { language } = useLanguage();
  const isEn = language === "en";
  const items = isEn ? GLOSSARY_ITEMS_EN : GLOSSARY_ITEMS_ID;

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
              <h3 className="font-display text-sm font-bold text-ink">
                {isEn ? "Coding Glossary" : "Kamus Istilah Ngoding"}
              </h3>
              <p className="text-micro text-muted">
                {isEn ? "Human-friendly analogies for programming terms" : "Bahasa manusia untuk istilah komputer"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? "Close glossary" : "Tutup kamus"}
            className="flex size-8 items-center justify-center rounded-lg border border-hairline bg-surface-raised/60 text-muted hover:text-ink hover:bg-surface-raised transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Terms List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
          {items.map((item, idx) => (
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
              <div className="flex items-start gap-1.5 text-xs text-ink/90 leading-relaxed mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember shrink-0 mt-0.5">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
                <span className="text-muted">{item.analogy}</span>
              </div>
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
            className="h-8 px-4 rounded-lg bg-ember text-obsidian text-xs font-bold hover:bg-ember-lo transition-colors cursor-pointer"
          >
            {isEn ? "Got it, back to learning" : "Paham, Balik Belajar"}
          </button>
        </div>
      </div>
    </div>
  );
}
