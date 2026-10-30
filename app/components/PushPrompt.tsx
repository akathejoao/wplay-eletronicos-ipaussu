"use client";

import React, { useEffect, useState } from "react";
import { Bell, BellRing, Check, Sparkles, X, Zap } from "lucide-react";
import {
  getExistingPushSubscription,
  isPushSupported,
  registerPushSubscription,
} from "@/lib/push-client";
import { isStandaloneApp } from "@/lib/app-install";

interface PushPromptProps {
  onFeedback?: (message: string) => void;
}

export function PushHeaderButton({ onFeedback }: PushPromptProps) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    setSupported(true);

    if (Notification.permission === "granted") {
      void getExistingPushSubscription().then((sub) => {
        if (sub) setSubscribed(true);
      });
    }
  }, []);

  if (!supported) return null;

  const handleSubscribe = async () => {
    if (subscribed) {
      onFeedback?.("Notificações já estão ativas neste dispositivo!");
      return;
    }

    setLoading(true);
    try {
      const result = await registerPushSubscription();
      if (result.success) {
        setSubscribed(true);
        onFeedback?.(result.message);
      } else {
        onFeedback?.(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`header-push-btn ${subscribed ? "header-push-active" : ""}`}
      onClick={handleSubscribe}
      disabled={loading}
      title={
        subscribed
          ? "Alertas de ofertas relâmpago ativados"
          : "Ativar alertas de ofertas relâmpago no celular"
      }
      aria-label="Ativar alertas de ofertas relâmpago"
    >
      {subscribed ? (
        <>
          <Check size={14} className="push-icon-active" />
          <span className="header-push-text">Alertas ativos</span>
        </>
      ) : loading ? (
        <>
          <Bell size={14} className="push-spin" />
          <span className="header-push-text">Ativando...</span>
        </>
      ) : (
        <>
          <Bell size={14} />
          <span className="header-push-text">Alertas VIP</span>
        </>
      )}
    </button>
  );
}

/**
 * Intelligent VIP Push notification trigger for Standalone installed app (PWA/APK/iOS Home Screen).
 * Shows automatically on app launch when permission is default.
 */
export function PushStandaloneVIPCard({ onFeedback }: PushPromptProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isPushSupported()) return;

    // Must be running inside the installed standalone app
    const standalone = isStandaloneApp();
    if (!standalone) return;

    // Check permission state
    if (Notification.permission !== "default") return;

    // Check if dismissed recently (7 days)
    const dismissedAt = localStorage.getItem("wplay_standalone_push_dismissed_at");
    if (dismissedAt) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - Number(dismissedAt) < sevenDaysMs) {
        return;
      }
    }

    // Show with a smooth 1.8s delay after app opening
    const timer = setTimeout(() => {
      setVisible(true);
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("wplay_standalone_push_dismissed_at", String(Date.now()));
    setVisible(false);
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      const result = await registerPushSubscription();
      if (result.success) {
        setVisible(false);
        onFeedback?.(result.message);
      } else {
        onFeedback?.(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="push-standalone-vip-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-vip-title"
    >
      <div className="push-vip-glow" aria-hidden="true" />
      <div className="push-vip-content">
        <div className="push-vip-badge">
          <Zap size={13} /> MEMBRO VIP DO APP WPLAY
        </div>
        <div className="push-vip-main">
          <div className="push-vip-icon-box">
            <BellRing size={26} className="push-bell-ring" />
            <Sparkles size={13} className="push-vip-sparkle" />
          </div>
          <div className="push-vip-copy">
            <h3 id="push-vip-title">Receba Ofertas Relâmpago e Reposição de iPhones</h3>
            <p>
              Ative as notificações instantâneas no seu app para saber de promoções no Pix e chegada de aparelhos antes de esgotar.
            </p>
          </div>
        </div>

        <div className="push-vip-actions">
          <button
            type="button"
            className="button button-lime push-vip-activate-btn"
            onClick={handleActivate}
            disabled={loading}
          >
            <Bell size={16} />
            {loading ? "Ativando alertas..." : "Ativar Notificações VIP"}
          </button>
          <button
            type="button"
            className="push-vip-dismiss-btn"
            onClick={handleDismiss}
          >
            Lembrar depois
          </button>
        </div>
      </div>
    </div>
  );
}

export function PushFloatingBanner({ onFeedback }: PushPromptProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;

    // If already in standalone app, the PushStandaloneVIPCard handles it
    if (isStandaloneApp()) return;

    // Check if user already granted or denied
    if (Notification.permission !== "default") return;

    // Check if dismissed recently (within 5 days)
    const dismissedAt = localStorage.getItem("wplay_push_banner_dismissed_at");
    if (dismissedAt) {
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
      if (Date.now() - Number(dismissedAt) < fiveDaysMs) {
        return;
      }
    }

    // Show after slight delay for polite onboarding
    const timer = setTimeout(() => {
      setVisible(true);
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("wplay_push_banner_dismissed_at", String(Date.now()));
    setVisible(false);
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      const result = await registerPushSubscription();
      if (result.success) {
        setVisible(false);
        onFeedback?.(result.message);
      } else {
        onFeedback?.(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <aside
      className="push-floating-banner"
      role="region"
      aria-label="Alertas de Ofertas Relâmpago"
    >
      <div className="push-banner-glow" aria-hidden="true" />
      <div className="push-banner-content">
        <div className="push-banner-icon-wrap">
          <BellRing size={22} className="push-bell-ring" />
          <span className="push-icon-sparkle">
            <Sparkles size={11} />
          </span>
        </div>
        <div className="push-banner-texts">
          <h4 className="push-banner-title">🔔 Alertas de Ofertas Relâmpago</h4>
          <p className="push-banner-desc">
            Receba notificações exclusivas de iPhones, queima de estoque e cupons PIX no seu app!
          </p>
        </div>
        <div className="push-banner-actions">
          <button
            type="button"
            className="push-banner-cta"
            onClick={handleActivate}
            disabled={loading}
          >
            {loading ? "Ativando..." : "Ativar alertas"}
          </button>
          <button
            type="button"
            className="push-banner-close"
            onClick={handleDismiss}
            title="Agora não"
            aria-label="Fechar alerta"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
