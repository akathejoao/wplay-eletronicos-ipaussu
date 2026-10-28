"use client";

import React, { useState } from "react";
import { Plus, Trash2, Smartphone, Info } from "lucide-react";
import { iphoneLineup, type IphoneModelSpec, type IphoneFinish } from "@/lib/iphone-models";

interface AdminPhoneModelsTabProps {
  customModels: IphoneModelSpec[];
  onSaveModels: (models: IphoneModelSpec[]) => Promise<boolean>;
  showToast: (message: string) => void;
}

export function AdminPhoneModelsTab({
  customModels,
  onSaveModels,
  showToast,
}: AdminPhoneModelsTabProps) {
  const [modelName, setModelName] = useState("");
  const [shortName, setShortName] = useState("");
  const [generation, setGeneration] = useState<number>(16);
  const [tier, setTier] = useState<IphoneModelSpec["tier"]>("pro");
  const [displaySize, setDisplaySize] = useState('6,7"');
  const [cameraLayout, setCameraLayout] = useState<IphoneModelSpec["cameraLayout"]>("pro-triple");
  const [frontFeature, setFrontFeature] = useState<IphoneModelSpec["frontFeature"]>("island");
  const [storagesText, setStoragesText] = useState("128 GB, 256 GB, 512 GB, 1 TB");
  const [chipset, setChipset] = useState("A18 Pro");
  const [highlight, setHighlight] = useState("Câmera 48 MP • Titânio Aeroespacial • Display 120Hz");
  const [colors, setColors] = useState<{ name: string; hex: string }[]>([
    { name: "Titânio Natural", hex: "#a49f99" },
    { name: "Titânio Preto", hex: "#2f3133" },
    { name: "Titânio Branco", hex: "#f0eeea" },
    { name: "Titânio Deserto", hex: "#bfa38d" },
  ]);

  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#c7f450");
  const [saving, setSaving] = useState(false);

  const handleAddColor = () => {
    if (!newColorName.trim()) {
      showToast("Informe o nome da cor.");
      return;
    }
    setColors([...colors, { name: newColorName.trim(), hex: newColorHex }]);
    setNewColorName("");
  };

  const handleRemoveColor = (index: number) => {
    setColors(colors.filter((_, i) => i !== index));
  };

  const handleApplyPreset = (preset: "iphone16" | "s24" | "xiaomi14") => {
    if (preset === "iphone16") {
      setModelName("iPhone 16 Pro Max");
      setShortName("16 Pro Max");
      setGeneration(16);
      setTier("promax");
      setDisplaySize('6,9"');
      setCameraLayout("pro-plateau");
      setFrontFeature("island");
      setStoragesText("256 GB, 512 GB, 1 TB");
      setChipset("A18 Pro");
      setHighlight("Botão Controle de Câmera • Chip A18 Pro • Bateria Recorde");
      setColors([
        { name: "Titânio Preto", hex: "#2b2c2e" },
        { name: "Titânio Branco", hex: "#f3f3f1" },
        { name: "Titânio Natural", hex: "#9b968e" },
        { name: "Titânio-deserto", hex: "#bfa38d" },
      ]);
      showToast("Modelo iPhone 16 Pro Max pré-preenchido!");
    } else if (preset === "s24") {
      setModelName("Galaxy S24 Ultra");
      setShortName("S24 Ultra");
      setGeneration(24);
      setTier("promax");
      setDisplaySize('6,8"');
      setCameraLayout("vertical-dual");
      setFrontFeature("island");
      setStoragesText("256 GB, 512 GB, 1 TB");
      setChipset("Snapdragon 8 Gen 3");
      setHighlight("Galaxy AI • Câmera 200 MP • Caneta S Pen Integrada");
      setColors([
        { name: "Cinza Titânio", hex: "#8c8882" },
        { name: "Preto Titânio", hex: "#232426" },
        { name: "Violeta Titânio", hex: "#4b4458" },
        { name: "Amarelo Titânio", hex: "#e5d8a8" },
      ]);
      showToast("Modelo Galaxy S24 Ultra pré-preenchido!");
    } else if (preset === "xiaomi14") {
      setModelName("Xiaomi 14 Ultra");
      setShortName("14 Ultra");
      setGeneration(14);
      setTier("promax");
      setDisplaySize('6,73"');
      setCameraLayout("pro-plateau");
      setFrontFeature("island");
      setStoragesText("256 GB, 512 GB");
      setChipset("Snapdragon 8 Gen 3");
      setHighlight("Lentes Leica Summilux • Sensor de 1 polegada • Display WQHD+");
      setColors([
        { name: "Preto Fosco", hex: "#1f2022" },
        { name: "Branco Cerâmica", hex: "#f4f4f4" },
      ]);
      showToast("Modelo Xiaomi 14 Ultra pré-preenchido!");
    }
  };

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim()) {
      showToast("Informe o nome do modelo.");
      return;
    }
    if (colors.length === 0) {
      showToast("Adicione pelo menos uma cor para o modelo.");
      return;
    }

    const storages = storagesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const finishes: IphoneFinish[] = colors.map((c, i) => ({
      id: `finish-${i + 1}-${c.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: c.name,
      bodyHex: c.hex,
      frameHex: c.hex,
      accentHex: "#c7f450",
      screenGlow: "#68f56c",
    }));

    const cleanId = `custom-${modelName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")}-${Date.now().toString().slice(-4)}`;

    const newModel: IphoneModelSpec = {
      id: cleanId,
      name: modelName.trim(),
      shortName: shortName.trim() || modelName.trim(),
      generation: Number(generation),
      tier,
      displaySize: displaySize.trim() || '6,1"',
      cameraLayout,
      frontFeature,
      storages: storages.length > 0 ? storages : ["128 GB", "256 GB"],
      finishes,
      chipset: chipset.trim() || "Processador Octa-Core",
      highlight: highlight.trim() || "Aparelho Selecionado WPlay",
    };

    const nextList = [...customModels, newModel];
    setSaving(true);
    try {
      if (await onSaveModels(nextList)) {
        showToast(`Modelo "${newModel.name}" adicionado às opções 3D!`);
        setModelName("");
        setShortName("");
      }
    } catch {
      showToast("Não foi possível salvar o modelo. Tente novamente.");
    } finally { setSaving(false); }
  };

  const handleDeleteModel = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o modelo "${name}"?`)) return;
    const nextList = customModels.filter((m) => m.id !== id);
    setSaving(true);
    try {
      if (await onSaveModels(nextList)) showToast(`Modelo "${name}" removido.`);
    } catch {
      showToast("Não foi possível remover o modelo. Tente novamente.");
    } finally { setSaving(false); }
  };

  return (
    <div className="admin-section-card">
      <div className="admin-products-head">
        <div>
          <h2>Linhas & Modelos 3D para Celulares</h2>
          <p className="admin-sub">
            Gerencie as linhas de celulares disponíveis no visualizador 3D do site.
            O visualizador 3D é exclusivo para smartphones.
          </p>
        </div>
      </div>

      {/* Modelos Personalizados Cadastrados */}
      <div className="admin-custom-models-section" style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, color: "#f3f6ef", marginBottom: 12 }}>
          Modelos Adicionados por Você ({customModels.length})
        </h3>
        {customModels.length === 0 ? (
          <div className="empty-state-card" style={{ padding: 24, textAlign: "center", background: "rgba(12, 24, 16, 0.4)", borderRadius: 12, border: "1px dashed rgba(172, 233, 122, 0.2)" }}>
            <Smartphone size={28} style={{ color: "#c7f450", marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13, color: "#a8ba9f" }}>
              Nenhum modelo personalizado adicionado ainda. Preencha o formulário abaixo para adicionar novas linhas ou modelos (ex: iPhone 16, Galaxy S24, Xiaomi)!
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 14 }}>
            {customModels.map((m) => (
              <div
                key={m.id}
                style={{
                  background: "rgba(14, 28, 18, 0.6)",
                  border: "1px solid rgba(172, 233, 122, 0.25)",
                  borderRadius: 12,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <strong style={{ fontSize: 15, color: "#ffffff" }}>{m.name}</strong>
                    <span style={{ fontSize: 10, background: "rgba(199, 244, 80, 0.15)", color: "#c7f450", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                      Geração {m.generation}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#a8ba9f" }}>{m.highlight}</p>
                  <div style={{ fontSize: 11, color: "#8ca085", marginBottom: 6 }}>
                    <strong>Capacidades:</strong> {m.storages.join(", ")}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#8ca085" }}>Cores:</span>
                    {m.finishes.map((f) => (
                      <span
                        key={f.id}
                        title={f.name}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: f.bodyHex,
                          border: "1px solid rgba(255,255,255,0.4)",
                          display: "inline-block",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteModel(m.id, m.name)}
                    style={{
                      background: "rgba(255, 80, 80, 0.12)",
                      border: "1px solid rgba(255, 80, 80, 0.3)",
                      color: "#ff6b6b",
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulário para Adicionar Novo Modelo */}
      <form onSubmit={handleCreateModel} className="product-form" style={{ background: "rgba(10, 22, 14, 0.5)", border: "1px solid rgba(172, 233, 122, 0.2)", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={18} style={{ color: "#c7f450" }} /> Adicionar Nova Linha ou Modelo
            </h3>
            <span style={{ fontSize: 12, color: "#a8ba9f" }}>Ou escolha um modelo pronto para agilizar:</span>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              className="button button-outline"
              style={{ padding: "6px 10px", fontSize: 12 }}
              onClick={() => handleApplyPreset("iphone16")}
            >
              + iPhone 16 Pro Max
            </button>
            <button
              type="button"
              className="button button-outline"
              style={{ padding: "6px 10px", fontSize: 12 }}
              onClick={() => handleApplyPreset("s24")}
            >
              + Galaxy S24 Ultra
            </button>
            <button
              type="button"
              className="button button-outline"
              style={{ padding: "6px 10px", fontSize: 12 }}
              onClick={() => handleApplyPreset("xiaomi14")}
            >
              + Xiaomi 14 Ultra
            </button>
          </div>
        </div>

        <div className="product-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label>
            <span>Nome Completo do Modelo</span>
            <input
              type="text"
              placeholder="Ex: iPhone 16 Pro Max"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Nome Curto (Pílula)</span>
            <input
              type="text"
              placeholder="Ex: 16 Pro Max"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
            />
          </label>

          <label>
            <span>Linha / Geração (Número)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={generation}
              onChange={(e) => setGeneration(Number(e.target.value))}
              required
            />
          </label>

          <label>
            <span>Categoria / Tier</span>
            <select value={tier} onChange={(e) => setTier(e.target.value as IphoneModelSpec["tier"])}>
              <option value="promax">Pro Max / Ultra (Topo de Linha)</option>
              <option value="pro">Pro (Profissional)</option>
              <option value="base">Base / Padrão</option>
              <option value="plus">Plus (Tela Grande)</option>
              <option value="air">Air / Slim</option>
            </select>
          </label>

          <label>
            <span>Tamanho da Tela</span>
            <input
              type="text"
              placeholder='Ex: 6,9"'
              value={displaySize}
              onChange={(e) => setDisplaySize(e.target.value)}
            />
          </label>

          <label>
            <span>Processador / Chipset</span>
            <input
              type="text"
              placeholder="Ex: A18 Pro ou Snapdragon 8 Gen 3"
              value={chipset}
              onChange={(e) => setChipset(e.target.value)}
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            <span>Capacidades de Memória (separadas por vírgula)</span>
            <input
              type="text"
              placeholder="128 GB, 256 GB, 512 GB, 1 TB"
              value={storagesText}
              onChange={(e) => setStoragesText(e.target.value)}
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            <span>Frase de Destaque Comercial</span>
            <input
              type="text"
              placeholder="Ex: Botão de Câmera • Titânio Aeroespacial • Bateria para o dia todo"
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
            />
          </label>
        </div>

        {/* Gerenciador de Cores do Modelo */}
        <div style={{ marginTop: 18, borderTop: "1px solid rgba(172, 233, 122, 0.15)", paddingTop: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f3f6ef", display: "block", marginBottom: 8 }}>
            Cores & Acabamentos do Modelo ({colors.length})
          </span>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {colors.map((c, idx) => (
              <span
                key={idx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(16, 32, 22, 0.8)",
                  border: "1px solid rgba(172, 233, 122, 0.3)",
                  padding: "4px 8px",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: c.hex,
                    border: "1px solid #fff",
                  }}
                />
                {c.name}
                <button
                  type="button"
                  onClick={() => handleRemoveColor(idx)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ff6b6b",
                    cursor: "pointer",
                    padding: 0,
                    marginLeft: 4,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Nome da cor (ex: Titânio Deserto)"
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              style={{ maxWidth: 220, fontSize: 13 }}
            />
            <input
              type="color"
              value={newColorHex}
              onChange={(e) => setNewColorHex(e.target.value)}
              style={{ width: 40, height: 36, padding: 2, background: "transparent", border: "1px solid rgba(172, 233, 122, 0.3)", borderRadius: 6, cursor: "pointer" }}
              title="Escolher tom da cor"
            />
            <button
              type="button"
              className="button button-outline"
              onClick={handleAddColor}
              style={{ padding: "8px 14px", fontSize: 13 }}
            >
              + Adicionar Cor
            </button>
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="button button-primary"
            disabled={saving}
            style={{ padding: "10px 22px", fontSize: 14 }}
          >
            {saving ? "Salvando..." : "Salvar Modelo na Vitrine 3D"}
          </button>
        </div>
      </form>

      {/* Referência da Linha Padrão Nativa */}
      <div style={{ marginTop: 36, borderTop: "1px solid rgba(172, 233, 122, 0.15)", paddingTop: 20 }}>
        <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "#a8ba9f", display: "flex", alignItems: "center", gap: 6 }}>
          <Info size={15} /> Linha Nativa Integrada (iPhone 13 ao 18 Pro Max — {iphoneLineup.length} modelos)
        </h4>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#7a8a75" }}>
          Estes modelos já vêm integrados de fábrica no motor 3D do site com shaders metálicos e dimensões fieis.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {iphoneLineup.map((m) => (
            <span
              key={m.id}
              style={{
                fontSize: 11,
                background: "rgba(10, 20, 14, 0.5)",
                border: "1px solid rgba(172, 233, 122, 0.15)",
                padding: "3px 8px",
                borderRadius: 6,
                color: "#c2d4bc",
              }}
            >
              {m.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
