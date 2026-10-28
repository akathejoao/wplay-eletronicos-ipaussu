export type IphoneFinish = {
  id: string;
  name: string;
  bodyHex: string;
  frameHex: string;
  accentHex: string;
  screenGlow: string;
};

export type IphoneModelSpec = {
  id: string;
  name: string;
  shortName: string;
  generation: number;
  tier: "base" | "plus" | "air" | "pro" | "promax";
  displaySize: string;
  cameraLayout: "diagonal-dual" | "vertical-dual" | "single-bar" | "pro-triple" | "pro-plateau";
  frontFeature: "notch" | "island";
  storages: string[];
  finishes: IphoneFinish[];
  chipset: string;
  highlight: string;
};

export function isPhoneModelSpec(value: unknown): value is IphoneModelSpec {
  if (!value || typeof value !== "object") return false;
  const model = value as Record<string, unknown>;
  const strings = ["id", "name", "shortName", "displaySize", "chipset", "highlight"];
  return strings.every((key) => typeof model[key] === "string" && String(model[key]).trim().length > 0) &&
    typeof model.generation === "number" && Number.isInteger(model.generation) && model.generation > 0 &&
    ["base", "plus", "air", "pro", "promax"].includes(String(model.tier)) &&
    ["diagonal-dual", "vertical-dual", "single-bar", "pro-triple", "pro-plateau"].includes(String(model.cameraLayout)) &&
    ["notch", "island"].includes(String(model.frontFeature)) &&
    Array.isArray(model.storages) && model.storages.length > 0 && model.storages.every((storage) => typeof storage === "string" && storage.trim()) &&
    Array.isArray(model.finishes) && model.finishes.length > 0 && model.finishes.every((finish) =>
      finish && typeof finish === "object" && typeof finish.id === "string" && typeof finish.name === "string" &&
      ["bodyHex", "frameHex", "accentHex", "screenGlow"].every((key) => typeof finish[key] === "string" && /^#[a-f\d]{6}$/i.test(finish[key])));
}

export const iphoneLineup: IphoneModelSpec[] = [
  // iPhone 13 Series
  {
    id: "iphone-13",
    name: "iPhone 13",
    shortName: "13",
    generation: 13,
    tier: "base",
    displaySize: '6,1"',
    cameraLayout: "diagonal-dual",
    frontFeature: "notch",
    storages: ["128 GB", "256 GB", "512 GB"],
    finishes: [
      { id: "midnight", name: "Meia-noite", bodyHex: "#1c2026", frameHex: "#2d333b", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "starlight", name: "Estelar", bodyHex: "#f2efe9", frameHex: "#dcd7ce", accentHex: "#c7f450", screenGlow: "#82f56b" },
      { id: "alpine-green", name: "Verde", bodyHex: "#394c38", frameHex: "#4b6149", accentHex: "#c7f450", screenGlow: "#50eb8b" },
      { id: "blue", name: "Azul", bodyHex: "#276787", frameHex: "#367b9e", accentHex: "#68f56c", screenGlow: "#38e8b0" },
      { id: "pink", name: "Rosa", bodyHex: "#f3d4d7", frameHex: "#e3bfc3", accentHex: "#c7f450", screenGlow: "#a8f774" },
    ],
    chipset: "A15 Bionic",
    highlight: "Câmera dupla diagonal · Super Retina XDR",
  },
  {
    id: "iphone-13-pro",
    name: "iPhone 13 Pro",
    shortName: "13 Pro",
    generation: 13,
    tier: "pro",
    displaySize: '6,1" ProMotion',
    cameraLayout: "pro-triple",
    frontFeature: "notch",
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "alpine", name: "Verde-alpino", bodyHex: "#4f5f4e", frameHex: "#6a7c68", accentHex: "#c7f450", screenGlow: "#7bf465" },
      { id: "graphite", name: "Grafite", bodyHex: "#383735", frameHex: "#52514e", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "sierra-blue", name: "Azul-Sierra", bodyHex: "#9bb5ce", frameHex: "#b4cade", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "gold", name: "Dourado", bodyHex: "#f4e8ce", frameHex: "#e1cfa8", accentHex: "#c7f450", screenGlow: "#c7f450" },
    ],
    chipset: "A15 Bionic 5-Core GPU",
    highlight: "ProMotion 120Hz · Sistema Pro 3 Câmeras + LiDAR",
  },
  {
    id: "iphone-13-pro-max",
    name: "iPhone 13 Pro Max",
    shortName: "13 Pro Max",
    generation: 13,
    tier: "promax",
    displaySize: '6,7" ProMotion',
    cameraLayout: "pro-triple",
    frontFeature: "notch",
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "alpine", name: "Verde-alpino", bodyHex: "#4f5f4e", frameHex: "#6a7c68", accentHex: "#c7f450", screenGlow: "#7bf465" },
      { id: "graphite", name: "Grafite", bodyHex: "#383735", frameHex: "#52514e", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "sierra-blue", name: "Azul-Sierra", bodyHex: "#9bb5ce", frameHex: "#b4cade", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "silver", name: "Prateado", bodyHex: "#ebece7", frameHex: "#d3d5cf", accentHex: "#c7f450", screenGlow: "#89f56c" },
    ],
    chipset: "A15 Bionic 5-Core GPU",
    highlight: "Tela 6,7\" 120Hz · Super Bateria + Câmeras Pro",
  },

  // iPhone 14 Series
  {
    id: "iphone-14",
    name: "iPhone 14",
    shortName: "14",
    generation: 14,
    tier: "base",
    displaySize: '6,1"',
    cameraLayout: "diagonal-dual",
    frontFeature: "notch",
    storages: ["128 GB", "256 GB", "512 GB"],
    finishes: [
      { id: "midnight", name: "Meia-noite", bodyHex: "#1d2228", frameHex: "#2f363f", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "starlight", name: "Estelar", bodyHex: "#f3f0e8", frameHex: "#dedad0", accentHex: "#c7f450", screenGlow: "#82f56b" },
      { id: "purple", name: "Roxo", bodyHex: "#dcd3e8", frameHex: "#c5b9d6", accentHex: "#7bf465", screenGlow: "#68f56c" },
      { id: "blue", name: "Azul", bodyHex: "#9cb2c9", frameHex: "#87a0ba", accentHex: "#3df08b", screenGlow: "#3df08b" },
    ],
    chipset: "A15 Bionic 5-Core",
    highlight: "Modo Ação · Photonic Engine · 5G",
  },
  {
    id: "iphone-14-plus",
    name: "iPhone 14 Plus",
    shortName: "14 Plus",
    generation: 14,
    tier: "plus",
    displaySize: '6,7"',
    cameraLayout: "diagonal-dual",
    frontFeature: "notch",
    storages: ["128 GB", "256 GB", "512 GB"],
    finishes: [
      { id: "midnight", name: "Meia-noite", bodyHex: "#1d2228", frameHex: "#2f363f", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "starlight", name: "Estelar", bodyHex: "#f3f0e8", frameHex: "#dedad0", accentHex: "#c7f450", screenGlow: "#82f56b" },
      { id: "blue", name: "Azul", bodyHex: "#9cb2c9", frameHex: "#87a0ba", accentHex: "#3df08b", screenGlow: "#3df08b" },
    ],
    chipset: "A15 Bionic 5-Core",
    highlight: "Super Tela 6,7\" · Bateria para o dia todo",
  },
  {
    id: "iphone-14-pro",
    name: "iPhone 14 Pro",
    shortName: "14 Pro",
    generation: 14,
    tier: "pro",
    displaySize: '6,1" ProMotion',
    cameraLayout: "pro-triple",
    frontFeature: "island",
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "deep-purple", name: "Roxo-profundo", bodyHex: "#483f54", frameHex: "#5d526b", accentHex: "#c7f450", screenGlow: "#7bf465" },
      { id: "space-black", name: "Preto-espacial", bodyHex: "#262526", frameHex: "#3c3b3c", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "silver", name: "Prateado", bodyHex: "#e9ebeb", frameHex: "#d0d4d4", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "gold", name: "Dourado", bodyHex: "#f2e5c9", frameHex: "#ddcba5", accentHex: "#c7f450", screenGlow: "#c7f450" },
    ],
    chipset: "A16 Bionic",
    highlight: "Dynamic Island · Câmera Principal 48 MP · Tela Sempre Ativa",
  },
  {
    id: "iphone-14-pro-max",
    name: "iPhone 14 Pro Max",
    shortName: "14 Pro Max",
    generation: 14,
    tier: "promax",
    displaySize: '6,7" ProMotion',
    cameraLayout: "pro-triple",
    frontFeature: "island",
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "deep-purple", name: "Roxo-profundo", bodyHex: "#483f54", frameHex: "#5d526b", accentHex: "#c7f450", screenGlow: "#7bf465" },
      { id: "space-black", name: "Preto-espacial", bodyHex: "#262526", frameHex: "#3c3b3c", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "silver", name: "Prateado", bodyHex: "#e9ebeb", frameHex: "#d0d4d4", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "gold", name: "Dourado", bodyHex: "#f2e5c9", frameHex: "#ddcba5", accentHex: "#c7f450", screenGlow: "#c7f450" },
    ],
    chipset: "A16 Bionic",
    highlight: "Dynamic Island · 6,7\" 120Hz · Câmera 48 MP ProRAW",
  },

  // iPhone 15 Series
  {
    id: "iphone-15",
    name: "iPhone 15",
    shortName: "15",
    generation: 15,
    tier: "base",
    displaySize: '6,1"',
    cameraLayout: "diagonal-dual",
    frontFeature: "island",
    storages: ["128 GB", "256 GB", "512 GB"],
    finishes: [
      { id: "black", name: "Preto", bodyHex: "#232629", frameHex: "#363a3f", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "green", name: "Verde", bodyHex: "#d1e2d0", frameHex: "#b8cfb6", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "blue", name: "Azul", bodyHex: "#d5dde5", frameHex: "#bcc8d4", accentHex: "#3df08b", screenGlow: "#22e58b" },
      { id: "pink", name: "Rosa", bodyHex: "#efd3d7", frameHex: "#dfb9bf", accentHex: "#c7f450", screenGlow: "#7bf465" },
    ],
    chipset: "A16 Bionic · USB-C",
    highlight: "Dynamic Island · Câmera 48 MP · Vidro colorido por infusão",
  },
  {
    id: "iphone-15-plus",
    name: "iPhone 15 Plus",
    shortName: "15 Plus",
    generation: 15,
    tier: "plus",
    displaySize: '6,7"',
    cameraLayout: "diagonal-dual",
    frontFeature: "island",
    storages: ["128 GB", "256 GB", "512 GB"],
    finishes: [
      { id: "black", name: "Preto", bodyHex: "#232629", frameHex: "#363a3f", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "green", name: "Verde", bodyHex: "#d1e2d0", frameHex: "#b8cfb6", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "blue", name: "Azul", bodyHex: "#d5dde5", frameHex: "#bcc8d4", accentHex: "#3df08b", screenGlow: "#22e58b" },
    ],
    chipset: "A16 Bionic · USB-C",
    highlight: "Tela 6,7\" Dynamic Island · Câmera 48 MP · USB-C",
  },
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    shortName: "15 Pro",
    generation: 15,
    tier: "pro",
    displaySize: '6,1" Titânio',
    cameraLayout: "pro-triple",
    frontFeature: "island",
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "natural-titanium", name: "Titânio Natural", bodyHex: "#9a958d", frameHex: "#b6b1a9", accentHex: "#c7f450", screenGlow: "#c7f450" },
      { id: "black-titanium", name: "Titânio Preto", bodyHex: "#28292b", frameHex: "#414346", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "white-titanium", name: "Titânio Branco", bodyHex: "#eae8e3", frameHex: "#d5d2cb", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "blue-titanium", name: "Titânio Azul", bodyHex: "#353d4a", frameHex: "#4c5666", accentHex: "#3df08b", screenGlow: "#22e58b" },
    ],
    chipset: "A17 Pro (3nm)",
    highlight: "Estrutura em Titânio · Botão de Ação · USB-C 3",
  },
  {
    id: "iphone-15-pro-max",
    name: "iPhone 15 Pro Max",
    shortName: "15 Pro Max",
    generation: 15,
    tier: "promax",
    displaySize: '6,7" Titânio',
    cameraLayout: "pro-triple",
    frontFeature: "island",
    storages: ["256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "natural-titanium", name: "Titânio Natural", bodyHex: "#9a958d", frameHex: "#b6b1a9", accentHex: "#c7f450", screenGlow: "#c7f450" },
      { id: "black-titanium", name: "Titânio Preto", bodyHex: "#28292b", frameHex: "#414346", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "white-titanium", name: "Titânio Branco", bodyHex: "#eae8e3", frameHex: "#d5d2cb", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "blue-titanium", name: "Titânio Azul", bodyHex: "#353d4a", frameHex: "#4c5666", accentHex: "#3df08b", screenGlow: "#22e58b" },
    ],
    chipset: "A17 Pro (3nm)",
    highlight: "Inicia em 256 GB · Zoom Óptico 5x Tetraprisma · Titânio",
  },

  // iPhone 16 Series
  {
    id: "iphone-16",
    name: "iPhone 16",
    shortName: "16",
    generation: 16,
    tier: "base",
    displaySize: '6,1"',
    cameraLayout: "vertical-dual",
    frontFeature: "island",
    storages: ["128 GB", "256 GB", "512 GB"],
    finishes: [
      { id: "ultramarine", name: "Ultramarino", bodyHex: "#5b6ee1", frameHex: "#7687ec", accentHex: "#c7f450", screenGlow: "#3df08b" },
      { id: "teal", name: "Verde-acinzentado", bodyHex: "#72a6a3", frameHex: "#8bbab7", accentHex: "#c7f450", screenGlow: "#3df08b" },
      { id: "black", name: "Preto", bodyHex: "#212427", frameHex: "#373b40", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "white", name: "Branco", bodyHex: "#f2f2f0", frameHex: "#dcdcd8", accentHex: "#3df08b", screenGlow: "#68f56c" },
    ],
    chipset: "A18 · Controle da Câmera",
    highlight: "Controle da Câmera lateral · Câmera Fusion 48 MP",
  },
  {
    id: "iphone-16-plus",
    name: "iPhone 16 Plus",
    shortName: "16 Plus",
    generation: 16,
    tier: "plus",
    displaySize: '6,7"',
    cameraLayout: "vertical-dual",
    frontFeature: "island",
    storages: ["128 GB", "256 GB", "512 GB"],
    finishes: [
      { id: "ultramarine", name: "Ultramarino", bodyHex: "#5b6ee1", frameHex: "#7687ec", accentHex: "#c7f450", screenGlow: "#3df08b" },
      { id: "teal", name: "Verde-acinzentado", bodyHex: "#72a6a3", frameHex: "#8bbab7", accentHex: "#c7f450", screenGlow: "#3df08b" },
      { id: "black", name: "Preto", bodyHex: "#212427", frameHex: "#373b40", accentHex: "#c7f450", screenGlow: "#68f56c" },
    ],
    chipset: "A18 · Controle da Câmera",
    highlight: "Super Tela 6,7\" · Bateria estendida · Controle da Câmera",
  },
  {
    id: "iphone-16-pro",
    name: "iPhone 16 Pro",
    shortName: "16 Pro",
    generation: 16,
    tier: "pro",
    displaySize: '6,3" Titânio',
    cameraLayout: "pro-triple",
    frontFeature: "island",
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "desert-titanium", name: "Titânio-deserto", bodyHex: "#b89f88", frameHex: "#cfb9a4", accentHex: "#c7f450", screenGlow: "#c7f450" },
      { id: "natural-titanium", name: "Titânio Natural", bodyHex: "#9d9890", frameHex: "#b7b2aa", accentHex: "#c7f450", screenGlow: "#7bf465" },
      { id: "black-titanium", name: "Titânio Preto", bodyHex: "#232426", frameHex: "#3c3e42", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "white-titanium", name: "Titânio Branco", bodyHex: "#eeede9", frameHex: "#d7d6d1", accentHex: "#3df08b", screenGlow: "#3df08b" },
    ],
    chipset: "A18 Pro",
    highlight: "Tela 6,3\" · Ultra-angular 48 MP · 4K 120 fps Dolby Vision",
  },
  {
    id: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    shortName: "16 Pro Max",
    generation: 16,
    tier: "promax",
    displaySize: '6,9" Titânio',
    cameraLayout: "pro-triple",
    frontFeature: "island",
    storages: ["256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "desert-titanium", name: "Titânio-deserto", bodyHex: "#b89f88", frameHex: "#cfb9a4", accentHex: "#c7f450", screenGlow: "#c7f450" },
      { id: "natural-titanium", name: "Titânio Natural", bodyHex: "#9d9890", frameHex: "#b7b2aa", accentHex: "#c7f450", screenGlow: "#7bf465" },
      { id: "black-titanium", name: "Titânio Preto", bodyHex: "#232426", frameHex: "#3c3e42", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "white-titanium", name: "Titânio Branco", bodyHex: "#eeede9", frameHex: "#d7d6d1", accentHex: "#3df08b", screenGlow: "#3df08b" },
    ],
    chipset: "A18 Pro",
    highlight: "Inicia em 256 GB · Tela 6,9\" ProMotion · Controle da Câmera",
  },

  // iPhone 17 Series
  {
    id: "iphone-17",
    name: "iPhone 17",
    shortName: "17",
    generation: 17,
    tier: "base",
    displaySize: '6,3" 120Hz',
    cameraLayout: "vertical-dual",
    frontFeature: "island",
    storages: ["256 GB", "512 GB"],
    finishes: [
      { id: "matcha-green", name: "Verde Matcha", bodyHex: "#7fa67a", frameHex: "#98bd93", accentHex: "#c7f450", screenGlow: "#7bf465" },
      { id: "obsidian", name: "Preto Obsidiana", bodyHex: "#1d2022", frameHex: "#33383c", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "mist-blue", name: "Azul-névoa", bodyHex: "#8da6bd", frameHex: "#a7bed3", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "pearl", name: "Branco Pérola", bodyHex: "#f3f4f1", frameHex: "#dcdfd9", accentHex: "#c7f450", screenGlow: "#7bf465" },
    ],
    chipset: "A19 · ProMotion 120Hz",
    highlight: "Inicia em 256 GB · Tela 120Hz · Câmera Frontal 24 MP",
  },
  {
    id: "iphone-17-air",
    name: "iPhone 17 Air",
    shortName: "17 Air",
    generation: 17,
    tier: "air",
    displaySize: '6,6" Ultra-Slim',
    cameraLayout: "single-bar",
    frontFeature: "island",
    storages: ["256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "sky-titanium", name: "Titânio Celeste", bodyHex: "#b8c9d9", frameHex: "#d0dfec", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "champagne-gold", name: "Ouro Claro", bodyHex: "#e5d9c3", frameHex: "#f1e8d6", accentHex: "#c7f450", screenGlow: "#c7f450" },
      { id: "carbon-black", name: "Preto Carbono", bodyHex: "#1e2022", frameHex: "#35393d", accentHex: "#c7f450", screenGlow: "#68f56c" },
    ],
    chipset: "A19 Pro · Design 5,6 mm",
    highlight: "Inicia em 256 GB · Chassi ultrafino · Barra óptica horizontal",
  },
  {
    id: "iphone-17-pro",
    name: "iPhone 17 Pro",
    shortName: "17 Pro",
    generation: 17,
    tier: "pro",
    displaySize: '6,3" ProMotion',
    cameraLayout: "pro-plateau",
    frontFeature: "island",
    storages: ["256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "emerald-titanium", name: "Verde-esmeralda", bodyHex: "#234236", frameHex: "#356150", accentHex: "#c7f450", screenGlow: "#3df08b" },
      { id: "copper-orange", name: "Cobre Solar", bodyHex: "#a85c3a", frameHex: "#c27450", accentHex: "#c7f450", screenGlow: "#c7f450" },
      { id: "deep-navy", name: "Azul-marinho", bodyHex: "#243044", frameHex: "#384863", accentHex: "#3df08b", screenGlow: "#22e58b" },
      { id: "silver-pro", name: "Prateado Pro", bodyHex: "#dadcd9", frameHex: "#eceee9", accentHex: "#c7f450", screenGlow: "#7bf465" },
    ],
    chipset: "A19 Pro · 12 GB RAM",
    highlight: "Inicia em 256 GB · Triplo 48 MP + Câmara de Vapor",
  },
  {
    id: "iphone-17-pro-max",
    name: "iPhone 17 Pro Max",
    shortName: "17 Pro Max",
    generation: 17,
    tier: "promax",
    displaySize: '6,9" ProMotion',
    cameraLayout: "pro-plateau",
    frontFeature: "island",
    storages: ["256 GB", "512 GB", "1 TB", "2 TB"],
    finishes: [
      { id: "emerald-titanium", name: "Verde-esmeralda", bodyHex: "#234236", frameHex: "#356150", accentHex: "#c7f450", screenGlow: "#3df08b" },
      { id: "copper-orange", name: "Cobre Solar", bodyHex: "#a85c3a", frameHex: "#c27450", accentHex: "#c7f450", screenGlow: "#c7f450" },
      { id: "deep-navy", name: "Azul-marinho", bodyHex: "#243044", frameHex: "#384863", accentHex: "#3df08b", screenGlow: "#22e58b" },
      { id: "silver-pro", name: "Prateado Pro", bodyHex: "#dadcd9", frameHex: "#eceee9", accentHex: "#c7f450", screenGlow: "#7bf465" },
    ],
    chipset: "A19 Pro · Até 2 TB",
    highlight: "256 GB a 2 TB · Tripla 48 MP Zoom 8x · Bateria Máxima",
  },

  // iPhone 18 Series
  {
    id: "iphone-18",
    name: "iPhone 18",
    shortName: "18",
    generation: 18,
    tier: "base",
    displaySize: '6,3" 120Hz',
    cameraLayout: "vertical-dual",
    frontFeature: "island",
    storages: ["256 GB", "512 GB"],
    finishes: [
      { id: "aurora-lime", name: "Verde Aurora", bodyHex: "#496946", frameHex: "#62895e", accentHex: "#c7f450", screenGlow: "#c7f450" },
      { id: "graphite-black", name: "Grafite", bodyHex: "#1c1f21", frameHex: "#31363a", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "glacier-silver", name: "Prata Glacial", bodyHex: "#e6eceb", frameHex: "#cdd6d4", accentHex: "#3df08b", screenGlow: "#3df08b" },
    ],
    chipset: "A20 (2nm)",
    highlight: "Inicia em 256 GB · Arquitetura 2nm · Neural Engine Ultra",
  },
  {
    id: "iphone-18-air",
    name: "iPhone 18 Air",
    shortName: "18 Air",
    generation: 18,
    tier: "air",
    displaySize: '6,6" Air Titanium',
    cameraLayout: "single-bar",
    frontFeature: "island",
    storages: ["256 GB", "512 GB", "1 TB"],
    finishes: [
      { id: "jade-mist", name: "Jade Acetinado", bodyHex: "#87a99b", frameHex: "#a1c2b4", accentHex: "#3df08b", screenGlow: "#3df08b" },
      { id: "titanium-ice", name: "Titânio Gelo", bodyHex: "#e2e6e9", frameHex: "#cbd2d6", accentHex: "#c7f450", screenGlow: "#7bf465" },
      { id: "obsidian-air", name: "Preto Obsidiana", bodyHex: "#191c1e", frameHex: "#2f3438", accentHex: "#c7f450", screenGlow: "#68f56c" },
    ],
    chipset: "A20 Air (2nm)",
    highlight: "Inicia em 256 GB · Chassi Aeroespacial 5,4 mm",
  },
  {
    id: "iphone-18-pro",
    name: "iPhone 18 Pro",
    shortName: "18 Pro",
    generation: 18,
    tier: "pro",
    displaySize: '6,3" ProMotion',
    cameraLayout: "pro-plateau",
    frontFeature: "island",
    storages: ["256 GB", "512 GB", "1 TB", "2 TB"],
    finishes: [
      { id: "wplay-titanium-jade", name: "Titânio Jade", bodyHex: "#2d4c3e", frameHex: "#436b58", accentHex: "#c7f450", screenGlow: "#c7f450" },
      { id: "black-obsidian", name: "Titânio Ônix", bodyHex: "#1a1c1d", frameHex: "#323638", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "bronze-titanium", name: "Titânio Bronze", bodyHex: "#7b624f", frameHex: "#967a64", accentHex: "#c7f450", screenGlow: "#7bf465" },
      { id: "platinum-white", name: "Titânio Platina", bodyHex: "#e8e9e4", frameHex: "#cfd1ca", accentHex: "#3df08b", screenGlow: "#3df08b" },
    ],
    chipset: "A20 Pro (2nm)",
    highlight: "256 GB a 2 TB · Abertura Variável Mecânica · Face ID sob a tela",
  },
  {
    id: "iphone-18-pro-max",
    name: "iPhone 18 Pro Max",
    shortName: "18 Pro Max",
    generation: 18,
    tier: "promax",
    displaySize: '6,9" ProMotion XDR',
    cameraLayout: "pro-plateau",
    frontFeature: "island",
    storages: ["256 GB", "512 GB", "1 TB", "2 TB"],
    finishes: [
      { id: "wplay-titanium-jade", name: "Titânio Jade", bodyHex: "#2d4c3e", frameHex: "#436b58", accentHex: "#c7f450", screenGlow: "#c7f450" },
      { id: "black-obsidian", name: "Titânio Ônix", bodyHex: "#1a1c1d", frameHex: "#323638", accentHex: "#c7f450", screenGlow: "#68f56c" },
      { id: "bronze-titanium", name: "Titânio Bronze", bodyHex: "#7b624f", frameHex: "#967a64", accentHex: "#c7f450", screenGlow: "#7bf465" },
      { id: "platinum-white", name: "Titânio Platina", bodyHex: "#e8e9e4", frameHex: "#cfd1ca", accentHex: "#3df08b", screenGlow: "#3df08b" },
    ],
    chipset: "A20 Pro Max (2nm)",
    highlight: "Topo de Linha 6,9\" · 256 GB a 2 TB · Teleobjetiva Variável 10x",
  },
];

export const iphoneGenerations = [13, 14, 15, 16, 17, 18] as const;

export function getIphoneModelById(id: string): IphoneModelSpec {
  return (
    iphoneLineup.find((m) => m.id === id) ||
    iphoneLineup.find((m) => m.id === "iphone-16-pro-max") ||
    iphoneLineup[0]
  );
}

export function formatIphoneSelectionSummary(
  model: IphoneModelSpec,
  storage: string,
  finish: IphoneFinish,
  condition: "Lacrado" | "Seminovo" = "Lacrado"
): string {
  return `${model.name} · ${storage} · ${finish.name} (${condition})`;
}
