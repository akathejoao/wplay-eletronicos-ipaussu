'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellRing, Sparkles, Check, X, RefreshCw } from 'lucide-react';
import { isStandaloneApp } from '@/lib/app-install';
import {
  isPushSupported,
  ensureServiceWorkerRegistered,
  registerPushSubscription,
  getExistingPushSubscription,
} from '@/lib/push-client';

interface PushPromptProps {
  onFeedback?: (message: string) => void;
}

export function PushHeaderButton({ onFeedback }: PushPromptProps) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!isPushSupported()) return;
    setSupported(true);

    if (Notification.permission === 'granted') {
      const sub = await getExistingPushSubscription();
      if (sub) {
        setSubscribed(true);
      }
    }
  }, []);

  useEffect(() => {
    void checkStatus();

    const handleGlobalSync = () => {
      setSubscribed(true);
    };

    window.addEventListener('wplay:push-subscribed', handleGlobalSync);
    return () => window.removeEventListener('wplay:push-subscribed', handleGlobalSync);
  }, [checkStatus]);

  if (!supported) return null;

  const handleAction = async () => {
    setLoading(true);
    try {
      const result = await registerPushSubscription();
      if (result.success) {
        setSubscribed(true);
        onFeedback?.(result.message);
      } else {
        onFeedback?.(result.message);
      }
    } catch {
      onFeedback?.('Não foi possível sincronizar o dispositivo no momento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`header-push-btn ${subscribed ? 'header-push-active' : ''}`}
      onClick={handleAction}
      disabled={loading}
      title={
        subscribed
          ? 'Alertas ativos no dispositivo (Toque para sincronizar)'
          : 'Ativar alertas de ofertas relâmpago no celular'
      }
      aria-label="Ativar ou sincronizar alertas de ofertas relâmpago"
    >
      {loading ? (
        <>
          <RefreshCw size={14} className="push-spin spin" />
          <span className="header-push-text">Sincronizando...</span>
        </>
      ) : subscribed ? (
        <>
          <Check size={14} className="push-icon-active" />
          <span className="header-push-text">Alertas ativos</span>
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

export function PushStandaloneVIPCard({ onFeedback }: PushPromptProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone = isStandaloneApp();
    if (!standalone) return;
    if (!isPushSupported()) return;

    // 1. Ensure Service Worker is registered immediately
    void ensureServiceWorkerRegistered();

    // 2. Silent Auto-Resync if already granted
    if (Notification.permission === 'granted') {
      void registerPushSubscription().then((res) => {
        if (res.success) {
          setSubscribed(true);
        }
      });
      return;
    }

    // 3. Prompt user if permission is still default
    if (Notification.permission === 'default') {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const result = await registerPushSubscription();
      if (result.success) {
        setSubscribed(true);
        onFeedback?.(result.message);
        setTimeout(() => setVisible(false), 2000);
      } else {
        onFeedback?.(result.message);
        setVisible(false);
      }
    } catch (err) {
      console.error('Falha ao ativar notificações VIP:', err);
      onFeedback?.('Não foi possível ativar notificações no momento.');
      setVisible(false);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="push-vip-overlay">
      <div className="push-vip-card">
        <div className="push-vip-glow" />
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="push-vip-close"
          aria-label="Dispensar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="push-vip-header">
          <div className="push-vip-icon-wrap">
            <BellRing className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="push-vip-badge">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Acesso VIP WPlay</span>
            </div>
            <h4 className="push-vip-title">Receba ofertas relâmpago no app</h4>
          </div>
        </div>

        <p className="push-vip-desc">
          Seja o primeiro a saber sobre reposição de iPhones, cupons de desconto exclusivos e novidades em tempo real.
        </p>

        <div className="push-vip-actions">
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={loading || subscribed}
            className="push-vip-btn-confirm"
          >
            {subscribed ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Alertas ativados!</span>
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                <span>{loading ? 'Ativando...' : 'Ativar Alertas VIP'}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="push-vip-btn-later"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

export function PushFloatingBanner({ onFeedback }: PushPromptProps) {
  const [canShow, setCanShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandaloneApp()) return; // Don't crowd UI inside standalone PWA
    if (!isPushSupported()) return;

    // Silent Auto-Resync if granted
    if (Notification.permission === 'granted') {
      void registerPushSubscription();
      return;
    }

    if (Notification.permission === 'default') {
      const dismissed = sessionStorage.getItem('push_prompt_dismissed');
      if (!dismissed) {
        setCanShow(true);
      }
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await registerPushSubscription();
      if (result.success) {
        onFeedback?.(result.message);
      } else {
        onFeedback?.(result.message);
      }
    } catch (err) {
      console.error('Erro no PushFloatingBanner:', err);
    } finally {
      setLoading(false);
      setCanShow(false);
    }
  };

  if (!canShow) return null;

  return (
    <div className="push-floating-bar">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">Receba novidades e ofertas VIP</p>
          <p className="text-[11px] text-zinc-400">Alertas de estoque de iPhone e cupons</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem('push_prompt_dismissed', 'true');
            setCanShow(false);
          }}
          className="text-xs text-zinc-400 hover:text-white px-2 py-1"
        >
          Depois
        </button>
        <button
          type="button"
          onClick={handleEnable}
          disabled={loading}
          className="text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg transition-colors"
        >
          {loading ? '...' : 'Ativar'}
        </button>
      </div>
    </div>
  );
}
