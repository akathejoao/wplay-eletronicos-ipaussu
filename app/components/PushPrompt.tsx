'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Sparkles, Check, X } from 'lucide-react';
import { isStandaloneApp } from '@/lib/app-install';

interface PushPromptProps {
  onFeedback?: (message: string) => void;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushHeaderButton({ onFeedback }: PushPromptProps) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setSupported(true);

    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setSubscribed(true);
        });
      });
    }
  }, []);

  if (!supported) return null;

  const handleSubscribe = async () => {
    if (subscribed) {
      onFeedback?.('Notificações já estão ativas neste dispositivo!');
      return;
    }

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        onFeedback?.('Permissão de notificações não concedida.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
        if (vapidPublicKey) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
          });
        }
      }

      if (subscription) {
        const res = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        });

        if (!res.ok) {
          throw new Error(`Erro ao registrar notificação: ${res.statusText}`);
        }

        setSubscribed(true);
        onFeedback?.('Alertas VIP ativados com sucesso!');
      }
    } catch (err) {
      console.error('Falha ao ativar notificações:', err);
      onFeedback?.('Não foi possível ativar notificações no momento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`header-push-btn ${subscribed ? 'header-push-active' : ''}`}
      onClick={handleSubscribe}
      disabled={loading}
      title={
        subscribed
          ? 'Alertas de ofertas relâmpago ativados'
          : 'Ativar alertas de ofertas relâmpago no celular'
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

export function PushStandaloneVIPCard({ onFeedback }: PushPromptProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone = isStandaloneApp();
    if (!standalone) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    if (Notification.permission === 'default') {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setVisible(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
        if (vapidPublicKey) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
          });
        }
      }

      if (subscription) {
        const res = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        });

        if (!res.ok) {
          throw new Error(`Erro ao registrar notificação: ${res.statusText}`);
        }

        setSubscribed(true);
        onFeedback?.('Alertas VIP ativados com sucesso!');
        setTimeout(() => setVisible(false), 2000);
      }
    } catch (err) {
      console.error('Falha ao ativar notificações VIP:', err);
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
    if (isStandaloneApp()) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

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
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
        if (vapidPublicKey) {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
          });
          const res = await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription),
          });
          if (!res.ok) {
            throw new Error(`Erro ao assinar: ${res.statusText}`);
          }
          onFeedback?.('Notificações de ofertas ativadas!');
        }
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
