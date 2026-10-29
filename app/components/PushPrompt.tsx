"use client";

import React, { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Check, Sparkles, X } from "lucide-react";
import {
  getExistingPushSubscription,
  isPushSupported,
  registerPushSubscription,
} from "@/lib/push-client";

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
          <span className="header-push-text">Alertas de ofertas</span>
        </>
      )}
    </button>
  );
}

export function PushFloatingBanner({ onFeedback }: PushPromptProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;

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
    }, 3500);

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
