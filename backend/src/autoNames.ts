function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]/g, "");
}

// Nama umum, mudah diucap (1–2 kata), kategori: planet/galaksi/nebula + buah.
const NAME_POOL = [
  "Mars",
  "Venus",
  "Jupiter",
  "Saturnus",
  "Neptunus",
  "Uranus",
  "Merkurius",
  "Pluto",
  "Orion",
  "Andromeda",
  "Bima Sakti",
  "Nebula",
  "Galaksi",
  "Kometa",
  "Meteor",
  "Apel",
  "Jeruk",
  "Anggur",
  "Mangga",
  "Pisang",
  "Melon",
  "Semangka",
  "Pepaya",
  "Nanas",
  "Lemon",
  "Stroberi",
  "Durian",
  "Pisang molen"
];

export function generateUniqueAutoName(usedNames: Iterable<string>, seed = Date.now()) {
  const used = new Set<string>();
  for (const n of usedNames) used.add(normalizeName(n));

  const start = Math.abs(seed) % NAME_POOL.length;
  for (let i = 0; i < NAME_POOL.length; i++) {
    const candidate = NAME_POOL[(start + i) % NAME_POOL.length]!;
    if (!used.has(normalizeName(candidate))) return candidate;
  }

  // Jika semua sudah terpakai, tambahkan suffix angka.
  const base = NAME_POOL[start] ?? "Device";
  for (let n = 2; n < 9999; n++) {
    const candidate = `${base} ${n}`;
    if (!used.has(normalizeName(candidate))) return candidate;
  }

  return `${base} ${Math.floor(Math.random() * 99999)}`;
}

export function isPlaceholderName(name: string | undefined | null) {
  if (!name) return true;
  const t = name.trim().toLowerCase();
  return t === "" || t === "device" || t === "perangkat" || t === "unknown";
}

export function normalizeForCompare(name: string) {
  return normalizeName(name);
}
