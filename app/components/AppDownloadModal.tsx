"use client";

import React, { useState, useEffect } from "react";
import { X, Download, Smartphone, Apple, CheckCircle2, Share, PlusSquare, ArrowRight, ShieldCheck } from "lucide-react";

interface AppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "android" | "ios" | "desktop";
  onTriggerPwaInstall?: () => Promise<void>;
  hasPwaPrompt?: boolean;
}

export function AppDownloadModal({
  isOpen,
  onClose,
  initialTab,
  onTriggerPwaInstall,
  hasPwaPrompt,
}: AppDownloadModalProps) {
  const [activeTab, setActiveTab] = useState<"android" | "ios" | "desktop">("android");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      return;
    }
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) {
        setActiveTab("ios");
      } else if (/android/.test(ua)) {
        setActiveTab("android");
      } else {
        setActiveTab("android");
      }
    }
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="ios-install-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="ios-install-sheet app-download-sheet"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button
          type="button"
          className="ios-install-close"
          onClick={onClose}
          aria-label="Fechar janela"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="ios-install-header">
          <div className="ios-app-icon-wrap">
            <img
              src="/images/wplay-logo-official.png"
              alt="WPlay App"
              className="ios-app-icon-img"
            />
          </div>
          <div>
            <h3>Baixar Aplicativo WPlay</h3>
            <p>Tenha acesso rápido ao estoque, preços reais e ofertas exclusivas</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="app-download-tabs">
          <button
            type="button"
            className={`app-download-tab-btn ${activeTab === "android" ? "active" : ""}`}
            onClick={() => setActiveTab("android")}
          >
            <Smartphone size={16} />
            <span>Android (APK)</span>
          </button>
          <button
            type="button"
            className={`app-download-tab-btn ${activeTab === "ios" ? "active" : ""}`}
            onClick={() => setActiveTab("ios")}
          >
            <Apple size={16} />
            <span>iPhone (iOS)</span>
          </button>
        </div>

        {/* TAB ANDROID */}
        {activeTab === "android" && (
          <div className="app-download-content">
            <div className="app-download-banner">
              <div className="app-badge-pill">
                <ShieldCheck size={14} /> Arquivo Verificado & Seguro
              </div>
              <h4>Instalação Direta no Android</h4>
              <p>Baixe o arquivo de instalação (.apk) diretamente para seu celular sem precisar de lojas externas.</p>

              <div className="app-download-actions">
                <a
                  href="/api/download/apk"
                  download="WPlay-Eletronicos.apk"
                  className="app-btn-download-primary"
                >
                  <Download size={18} />
                  <span>
                    <strong>Baixar APK Direto</strong>
                    <small>Versão 1.0.0 Oficial (APK Rápido)</small>
                  </span>
                </a>

                {hasPwaPrompt && onTriggerPwaInstall && (
                  <button
                    type="button"
                    className="app-btn-pwa-secondary"
                    onClick={() => {
                      void onTriggerPwaInstall();
                      onClose();
                    }}
                  >
                    <span>Ou Instalar via Navegador (PWA Instantâneo)</span>
                  </button>
                )}
              </div>
            </div>

            <div className="app-install-steps">
              <h5>Como instalar após o download:</h5>
              <div className="app-step-item">
                <span className="app-step-num">1</span>
                <div>
                  <strong>Toque em Baixar APK</strong>
                  <p>O download começará automaticamente no seu navegador.</p>
                </div>
              </div>
              <div className="app-step-item">
                <span className="app-step-num">2</span>
                <div>
                  <strong>Abra o arquivo baixado</strong>
                  <p>Abra a barra de notificações ou a pasta "Downloads" e toque em <code>WPlay-Eletronicos.apk</code>.</p>
                </div>
              </div>
              <div className="app-step-item">
                <span className="app-step-num">3</span>
                <div>
                  <strong>Permita a instalação e conclua</strong>
                  <p>Se solicitado pelo Android, marque "Permitir desta fonte" e confirme a instalação.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB IPHONE / IOS */}
        {activeTab === "ios" && (
          <div className="app-download-content">
            <div className="app-download-banner ios-banner">
              <div className="app-badge-pill">
                <Apple size={14} /> Oficial para Safari / iOS
              </div>
              <h4>Como instalar o App no seu iPhone</h4>
              <p>
                No iPhone, você não precisa de APK. O sistema da Apple permite instalar o aplicativo completo direto pelo Safari em 3 passos:
              </p>
            </div>

            <div className="ios-install-steps">
              <div className="ios-step-card">
                <div className="ios-step-icon">
                  <Share size={20} />
                </div>
                <div className="ios-step-body">
                  <span className="ios-step-label">Passo 1</span>
                  <strong>Toque no botão Compartilhar</strong>
                  <p>Na barra inferior do Safari, clique no ícone do quadrado com a seta para cima.</p>
                </div>
              </div>

              <div className="ios-step-card">
                <div className="ios-step-icon">
                  <PlusSquare size={20} />
                </div>
                <div className="ios-step-body">
                  <span className="ios-step-label">Passo 2</span>
                  <strong>Selecione "Adicionar à Tela de Início"</strong>
                  <p>Role o menu para baixo até encontrar a opção com o símbolo de mais (+).</p>
                </div>
              </div>

              <div className="ios-step-card">
                <div className="ios-step-icon">
                  <CheckCircle2 size={20} />
                </div>
                <div className="ios-step-body">
                  <span className="ios-step-label">Passo 3</span>
                  <strong>Toque em "Adicionar"</strong>
                  <p>No canto superior direito da tela, confirme em "Adicionar". Pronto!</p>
                </div>
              </div>
            </div>

            <div className="ios-install-tip">
              <p>
                ✨ <strong>Vantagens no iPhone:</strong> Abre em tela cheia sem barra de endereço, carrega instantâneo e permite receber notificações de novas chegadas de aparelhos!
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="ios-install-footer">
          <button type="button" className="ios-btn-got-it" onClick={onClose}>
            Entendido, fechar
          </button>
        </div>
      </div>
    </div>
  );
}
