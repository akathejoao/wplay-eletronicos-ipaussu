"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Apple,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  PlusSquare,
  Share,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  detectInstallPlatform,
  getInAppBrowserName,
  isInAppBrowser,
  type InstallPlatform,
} from "@/lib/app-install";

interface AppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: InstallPlatform;
  onTriggerPwaInstall: () => Promise<void>;
  hasPwaPrompt: boolean;
  installed: boolean;
}

export function AppDownloadModal({
  isOpen,
  onClose,
  initialTab,
  onTriggerPwaInstall,
  hasPwaPrompt,
  installed,
}: AppDownloadModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [activeTab, setActiveTab] = useState<InstallPlatform>("android");
  const [inApp, setInApp] = useState(false);
  const [inAppName, setInAppName] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [installing, setInstalling] = useState(false);
  const [apkAvailable, setApkAvailable] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    const detectedPlatform = initialTab ?? detectInstallPlatform(navigator);
    setActiveTab(detectedPlatform);
    setCopyStatus("");

    const isInternalBrowser = isInAppBrowser(navigator.userAgent);
    setInApp(isInternalBrowser);
    setInAppName(getInAppBrowserName(navigator.userAgent));

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

    void fetch("/api/download/apk", {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => {
        if (!cancelled) setApkAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setApkAvailable(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen]);

  const copySiteLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/`);
      setCopyStatus("Link copiado com sucesso! Abra no navegador.");
      setTimeout(() => setCopyStatus(""), 4000);
    } catch {
      setCopyStatus(`Copie o endereço: ${window.location.origin}/`);
    }
  };

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      await onTriggerPwaInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={`app-install-dialog ${activeTab === "ios" ? "dialog-ios" : ""}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {isOpen && (
        <div
          className={`app-install-sheet ${
            activeTab === "ios" ? "app-install-sheet-ios" : ""
          }`}
        >
          {/* iOS Bottom Sheet Drag Indicator */}
          <div className="sheet-drag-handle" aria-hidden="true" />

          <button
            type="button"
            className="app-install-close"
            onClick={onClose}
            aria-label="Fechar janela de instalação do app"
            autoFocus
          >
            <X size={20} />
          </button>

          <header className="app-install-heading">
            <img
              src="/icons/apple-touch-icon.png"
              alt="Logo WPlay"
              width={56}
              height={56}
              className="app-install-appicon"
            />
            <div>
              <div className="app-install-badge-row">
                <span className="app-pwa-badge">
                  <Zap size={12} /> App Oficial WPlay
                </span>
                <span className="app-pwa-size">1.8 MB</span>
              </div>
              <h2 id={`${id}-title`}>Instale a WPlay no seu celular</h2>
              <p id={`${id}-description`}>
                Experiência de aplicativo nativo sem anúncios, com carregamento instantâneo.
              </p>
            </div>
          </header>

          {/* In-App Browser Warning (Instagram, Facebook, TikTok) */}
          {inApp && (
            <div className="app-install-inapp-alert" role="alert">
              <div className="inapp-alert-icon">
                <Compass size={20} />
              </div>
              <div className="inapp-alert-text">
                <strong>Você está no navegador interno do {inAppName || "App"}</strong>
                <p>
                  Para instalar o aplicativo em 1 clique sem restrições, toque nos{" "}
                  <strong>3 pontinhos (⋯ ou ⋮)</strong> no canto da tela e selecione{" "}
                  <strong>&quot;Abrir no navegador externo&quot;</strong> (Safari ou Chrome).
                </p>
                <button
                  type="button"
                  className="button button-outline inapp-copy-btn"
                  onClick={copySiteLink}
                >
                  <Copy size={14} /> Copiar link da WPlay
                </button>
                {copyStatus && <span className="copy-feedback-msg">{copyStatus}</span>}
              </div>
            </div>
          )}

          {installed && (
            <p className="app-install-note app-install-success">
              <Check size={18} /> A WPlay já está instalada e ativa neste dispositivo.
            </p>
          )}

          {/* Platform Switcher Tabs */}
          <div
            className="app-install-tabs"
            role="tablist"
            aria-label="Selecione seu sistema operacional"
          >
            {(["android", "ios"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`${id}-${tab}-tab`}
                aria-selected={activeTab === tab}
                aria-controls={`${id}-${tab}-panel`}
                tabIndex={activeTab === tab ? 0 : -1}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "android" ? <Smartphone size={17} /> : <Apple size={17} />}
                {tab === "android" ? "Android" : "iPhone / iPad"}
              </button>
            ))}
          </div>

          {/* ANDROID PANEL: 1-Click Native WebAPK + Manual APK fallback */}
          <section
            role="tabpanel"
            id={`${id}-android-panel`}
            aria-labelledby={`${id}-android-tab`}
            hidden={activeTab !== "android"}
            tabIndex={0}
          >
            <div className="install-benefits-strip">
              <span>⚡ Roda em tela cheia</span>
              <span>🛡️ Sem alertas do Play Protect</span>
              <span>🔔 Notificações relâmpago</span>
            </div>

            {hasPwaPrompt && !installed ? (
              <div className="native-prompt-cta-box">
                <button
                  type="button"
                  className="app-install-primary pulse-subtle"
                  disabled={installing}
                  onClick={() => void handleInstallClick()}
                >
                  <Zap size={18} />
                  {installing ? "Instalando aplicativo..." : "Instalar App Oficial (1 Clique)"}
                </button>
                <small className="native-cta-subtext">
                  Instalação limpa e segura gerenciada pelo Google Chrome.
                </small>
              </div>
            ) : (
              <div className="manual-browser-steps">
                <h4>Adicione à tela inicial pelo navegador:</h4>
                <ol className="app-install-steps">
                  <li>
                    Toque no menu <strong>⋮ (três pontinhos)</strong> no canto do navegador.
                  </li>
                  <li>
                    Selecione <strong>&quot;Instalar aplicativo&quot;</strong> ou{" "}
                    <strong>&quot;Adicionar à tela inicial&quot;</strong>.
                  </li>
                  <li>Confirme para ter o app com ícone oficial na sua tela inicial.</li>
                </ol>
              </div>
            )}

            {/* Discrete APK download fallback */}
            <div className="apk-fallback-container">
              <span className="apk-fallback-label">Prefere o arquivo .apk tradicional?</span>
              <a
                href={apkAvailable ? "/api/download/apk" : "/WPlay-Eletronicos.apk"}
                download="WPlay-Eletronicos.apk"
                className="apk-fallback-link"
              >
                <Download size={14} /> Baixar pacote APK manualmente
              </a>
            </div>
          </section>

          {/* IOS PANEL: Native iOS Bottom Sheet Visual Steps */}
          <section
            role="tabpanel"
            id={`${id}-ios-panel`}
            aria-labelledby={`${id}-ios-tab`}
            hidden={activeTab !== "ios"}
            tabIndex={0}
            className="ios-install-flow"
          >
            <div className="ios-flow-header">
              <h3>Adicione à Tela de Início do iPhone</h3>
              <p>Sem precisar de App Store. Ocupa menos de 2 MB e roda em tela cheia.</p>
            </div>

            <ol className="ios-visual-stepper">
              <li className="ios-step-card">
                <div className="ios-step-num">1</div>
                <div className="ios-step-icon">
                  <Share size={22} className="ios-icon-share" />
                </div>
                <div className="ios-step-info">
                  <strong>Toque em Compartilhar</strong>
                  <p>Procure o ícone do quadrado com a seta para cima na barra inferior do Safari.</p>
                </div>
              </li>

              <li className="ios-step-card">
                <div className="ios-step-num">2</div>
                <div className="ios-step-icon">
                  <PlusSquare size={22} className="ios-icon-plus" />
                </div>
                <div className="ios-step-info">
                  <strong>Adicionar à Tela de Início</strong>
                  <p>Role o menu para baixo até localizar essa opção e toque nela.</p>
                </div>
              </li>

              <li className="ios-step-card">
                <div className="ios-step-num">3</div>
                <div className="ios-step-icon">
                  <Check size={22} className="ios-icon-check" />
                </div>
                <div className="ios-step-info">
                  <strong>Toque em Adicionar</strong>
                  <p>No canto superior direito, confirme para fixar o app com ícone da WPlay.</p>
                </div>
              </li>
            </ol>

            <div className="ios-vip-tip">
              <Sparkles size={16} />
              <span>
                Após abrir o app pela Tela de Início, você poderá ativar alertas VIP de ofertas relâmpago!
              </span>
            </div>
          </section>

          <button
            type="button"
            className="app-install-secondary app-install-done"
            onClick={onClose}
          >
            Voltar à loja
          </button>
        </div>
      )}
    </dialog>
  );
}
