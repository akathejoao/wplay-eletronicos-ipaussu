"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Apple, Check, Copy, Download, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { detectInstallPlatform, type InstallPlatform } from "@/lib/app-install";

interface AppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: InstallPlatform;
  onTriggerPwaInstall: () => Promise<void>;
  hasPwaPrompt: boolean;
  installed: boolean;
}

export function AppDownloadModal({ isOpen, onClose, initialTab, onTriggerPwaInstall, hasPwaPrompt, installed }: AppDownloadModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [activeTab, setActiveTab] = useState<InstallPlatform>("android");
  const [apkStatus, setApkStatus] = useState<"checking" | "available" | "unavailable">("checking");
  const [needsSafari, setNeedsSafari] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [installing, setInstalling] = useState(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    setActiveTab(initialTab ?? detectInstallPlatform(navigator));
    setCopyStatus("");
    setNeedsSafari(detectInstallPlatform(navigator) === "ios" &&
      (!/Safari/i.test(navigator.userAgent) || /CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV/i.test(navigator.userAgent)));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setApkStatus("checking");
    void fetch("/api/download/apk", { method: "HEAD", cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!cancelled) setApkStatus(response.ok ? "available" : "unavailable");
      })
      .catch(() => { if (!cancelled) setApkStatus("unavailable"); })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen]);

  const copySiteLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/`);
      setCopyStatus("Link copiado. Cole na barra de endereços do Safari.");
    } catch {
      setCopyStatus(`Abra o Safari e acesse ${window.location.origin}/`);
    }
  };

  const installFromBrowser = async () => {
    setInstalling(true);
    try { await onTriggerPwaInstall(); }
    finally { setInstalling(false); }
  };

  return (
    <dialog ref={dialogRef} className="app-install-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      {isOpen && <div className="app-install-sheet">
        <button type="button" className="app-install-close" onClick={onClose} aria-label="Fechar instalação do app" autoFocus><X size={20} /></button>
        <header className="app-install-heading">
          <img src="/icons/apple-touch-icon.png" alt="" width={56} height={56} />
          <div><h2 id={`${id}-title`}>Leve a WPlay com você.</h2><p id={`${id}-description`}>Acesse o catálogo direto da tela inicial do seu celular.</p></div>
        </header>

        {installed && <p className="app-install-note"><Check size={18} /> A WPlay já está instalada neste dispositivo.</p>}

        <div className="app-install-tabs" role="tablist" aria-label="Sistema do celular">
          {(["android", "ios"] as const).map((tab) => (
            <button key={tab} type="button" role="tab" id={`${id}-${tab}-tab`} aria-selected={activeTab === tab}
              aria-controls={`${id}-${tab}-panel`} tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === "Home" ? "android" : event.key === "End" ? "ios" : tab === "android" ? "ios" : "android";
                setActiveTab(next);
                document.getElementById(`${id}-${next}-tab`)?.focus();
              }}>
              {tab === "android" ? <Smartphone size={18} /> : <Apple size={18} />}
              {tab === "android" ? "Android" : "iPhone / iPad"}
            </button>
          ))}
        </div>

        <section role="tabpanel" id={`${id}-android-panel`} aria-labelledby={`${id}-android-tab`} hidden={activeTab !== "android"} tabIndex={0}>
          <h3>Instalar no Android</h3>
          <p>Adicione a WPlay direto à tela inicial do seu celular para abrir em tela cheia com acesso instantâneo e sem barra de navegação.</p>
          
          {hasPwaPrompt && !installed && (
            <button type="button" className="app-install-primary" disabled={installing} onClick={() => void installFromBrowser()}>
              <PlusSquare size={18} /> {installing ? "Aguardando o navegador…" : "Instalar App no Celular"}
            </button>
          )}

          <div style={{ marginTop: "20px" }}>
            <h4>Passo a passo no Chrome ou Samsung Internet:</h4>
            <ol className="app-install-steps">
              <li>Toque no menu <strong>⋮ (três pontinhos)</strong> no topo do navegador.</li>
              <li>Toque em <strong>&quot;Instalar aplicativo&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>.</li>
              <li>Toque em <strong>Instalar</strong> para confirmar.</li>
            </ol>
            <p className="app-install-note" style={{ marginTop: "16px" }}>
              Pronto! O aplicativo oficial da WPlay será criado na tela inicial do seu celular com ícone oficial e carregamento rápido.
            </p>
          </div>

          {apkStatus === "available" && (
            <div className="app-install-apk" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px" }}>Opção alternativa em arquivo APK:</p>
              <a href="/api/download/apk" download="WPlay-Eletronicos.apk" className="app-install-secondary"><Download size={16} /> Baixar APK manual</a>
            </div>
          )}
        </section>

        <section role="tabpanel" id={`${id}-ios-panel`} aria-labelledby={`${id}-ios-tab`} hidden={activeTab !== "ios"} tabIndex={0}>
          <h3>Instalar no iPhone ou iPad</h3>
          <p>Abra este site no <strong>Safari</strong> e adicione a WPlay à Tela de Início.</p>
          {needsSafari && <div className="app-install-note app-install-safari"><p>Você está em outro navegador. Copie o link e abra no Safari para seguir os passos.</p><button type="button" className="app-install-secondary" onClick={() => void copySiteLink()}><Copy size={16} /> Copiar link do site</button><p role="status">{copyStatus}</p></div>}
          <ol className="app-install-steps app-install-ios-steps">
            <li><Share size={22} /><div><strong>Toque em Compartilhar</strong><p>Procure o quadrado com a seta para cima na barra do Safari. Em algumas versões, ele fica no menu Mais.</p></div></li>
            <li><PlusSquare size={22} /><div><strong>Adicionar à Tela de Início</strong><p>Role as opções do menu até encontrar essa opção.</p></div></li>
            <li><Check size={22} /><div><strong>Confirme em Adicionar</strong><p>Se aparecer “Abrir como App”, mantenha a opção ativada. O ícone da WPlay ficará na sua tela inicial.</p></div></li>
          </ol>
          <p className="app-install-note">A instalação usa o próprio site. Não é necessário baixar um APK no iPhone. A consulta ao catálogo precisa de conexão com a internet.</p>
        </section>
        <button type="button" className="app-install-secondary app-install-done" onClick={onClose}>Voltar à loja</button>
      </div>}
    </dialog>
  );
}
