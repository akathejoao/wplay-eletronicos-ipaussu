'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Clock, Sparkles, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { registerPushSubscription, isPushSupported } from '@/lib/push-client';
import { createClient } from '@/lib/supabase';
import { adminSessionStorageKey } from '@/lib/catalog';

interface PushDispatchResult {
  ok?: boolean;
  sentCount?: number;
  failedCount?: number;
  cleanedCount?: number;
  total?: number;
  message?: string;
  error?: string;
}

interface AdminPushTesterProps {
  onDispatched?: (result: PushDispatchResult) => void;
  className?: string;
}

const DEMO_PAYLOAD = {
  title: '🔥 Oferta Relâmpago WPlay!',
  body: 'iPhone 16 Pro Max 256GB com R$ 800 OFF e entrega imediata. Toque para ver no Estúdio 3D!',
  url: '/?source=pwa',
};

export function AdminPushTester({ onDispatched, className }: AdminPushTesterProps) {
  const [loading, setLoading] = useState(false);
  const [syncingSelf, setSyncingSelf] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    stats?: { sent: number; total: number; failed: number; cleaned: number };
  } | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleGlobalSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ totalSubscribers?: number }>;
      onDispatched?.({ total: customEvent.detail?.totalSubscribers });
    };

    window.addEventListener('wplay:push-subscribed', handleGlobalSync);

    return () => {
      window.removeEventListener('wplay:push-subscribed', handleGlobalSync);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [onDispatched]);

  const getAdminAuthHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-admin-key': 'wplay-admin-verified',
      'x-admin-session': 'active',
    };

    if (typeof window !== 'undefined') {
      try {
        const supabase = createClient();
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            headers['Authorization'] = `Bearer ${data.session.access_token}`;
          }
        }
      } catch {
        // Fallback gracioso
      }

      try {
        const stored = sessionStorage.getItem(adminSessionStorageKey) || sessionStorage.getItem('wplay-admin-session-v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.token && !headers['Authorization']) {
            headers['Authorization'] = parsed.token.startsWith('Bearer ') ? parsed.token : `Bearer ${parsed.token}`;
          }
        }
      } catch {
        // Fallback gracioso
      }
    }

    return headers;
  };

  const executeSend = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const authHeaders = await getAdminAuthHeaders();
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify(DEMO_PAYLOAD),
      });

      const data: PushDispatchResult = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        throw new Error(data.error || `Erro HTTP ${response.status}: falha ao processar disparo.`);
      }

      const sentCount = typeof data.sentCount === 'number' ? data.sentCount : 0;
      const totalCount = typeof data.total === 'number' ? data.total : sentCount;
      const failedCount = typeof data.failedCount === 'number' ? data.failedCount : 0;
      const cleanedCount = typeof data.cleanedCount === 'number' ? data.cleanedCount : 0;

      onDispatched?.(data);

      if (sentCount > 0) {
        setFeedback({
          type: 'success',
          message: `🔥 Sucesso! Notificação entregue para ${sentCount} aparelho(s) conectado(s).`,
          stats: { sent: sentCount, total: totalCount, failed: failedCount, cleaned: cleanedCount },
        });
      } else {
        setFeedback({
          type: 'warning',
          message:
            'Aviso: Disparo concluído, mas nenhum aparelho recebeu (0 inscritos). Clique no botão "Inscrever este Aparelho" abaixo para conectar seu celular à base de testes agora mesmo.',
          stats: { sent: 0, total: totalCount, failed: failedCount, cleaned: cleanedCount },
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha na conexão com o servidor de Web Push.';
      setFeedback({
        type: 'error',
        message,
      });
    } finally {
      setLoading(false);
      setCountdown(null);
    }
  };

  const handleImmediateSend = () => {
    if (loading || countdown !== null) return;
    void executeSend();
  };

  const handleCountdownSend = () => {
    if (loading || countdown !== null) return;

    let secondsLeft = 5;
    setCountdown(secondsLeft);
    setFeedback(null);

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    countdownTimerRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        setCountdown(secondsLeft);
      } else {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdown(null);
        void executeSend();
      }
    }, 1000);
  };

  const handleRegisterCurrentDevice = async () => {
    if (syncingSelf) return;
    setSyncingSelf(true);
    setFeedback(null);

    try {
      if (!isPushSupported()) {
        throw new Error('Notificações não são suportadas neste navegador. No iPhone, certifique-se de que o app foi aberto pela Tela de Início.');
      }

      const result = await registerPushSubscription();
      if (result.success) {
        // Sincronização imediata com cache: 'no-store'
        let freshTotal = result.totalSubscribers;
        try {
          const authHeaders = await getAdminAuthHeaders();
          const syncRes = await fetch('/api/notifications/subscribe', {
            cache: 'no-store',
            headers: authHeaders,
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (typeof syncData.count === 'number') {
              freshTotal = syncData.count;
            } else if (typeof syncData.total === 'number') {
              freshTotal = syncData.total;
            }
          }
        } catch {
          // ignore
        }

        setFeedback({
          type: 'success',
          message: `Dispositivo conectado! ${freshTotal !== undefined ? `Base atualizada para ${freshTotal} aparelho(s).` : 'Inscrição salva com sucesso.'}`,
        });
        onDispatched?.({ total: freshTotal });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('wplay:push-subscribed', {
              detail: { totalSubscribers: freshTotal },
            })
          );
        }
      } else {
        throw new Error(result.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar dispositivo.';
      setFeedback({
        type: 'error',
        message,
      });
    } finally {
      setSyncingSelf(false);
    }
  };

  return (
    <div
      className={`admin-push-tester-card ${className || ''}`}
      style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(13, 17, 23, 0.95) 100%)',
        border: '1px solid rgba(52, 211, 153, 0.25)',
        borderRadius: '1.25rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '0.75rem',
              background: 'rgba(52, 211, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Simulador de Disparo Web Push (Apresentação ao Cliente)
            </h4>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
              Teste a entrega instantânea na tela de bloqueio do celular
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0.25rem 0.5rem',
            borderRadius: '9999px',
            background: 'rgba(52, 211, 153, 0.12)',
            color: '#34d399',
            border: '1px solid rgba(52, 211, 153, 0.2)',
          }}
        >
          RFC 8292
        </span>
      </div>

      <div
        style={{
          background: 'rgba(0, 0, 0, 0.35)',
          borderRadius: '0.75rem',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#34d399', marginBottom: '0.25rem' }}>
          {DEMO_PAYLOAD.title}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#d1d5db', lineHeight: 1.4 }}>
          {DEMO_PAYLOAD.body}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          style={{
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            background:
              feedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.12)'
                : feedback.type === 'warning'
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${
              feedback.type === 'success'
                ? 'rgba(52, 211, 153, 0.3)'
                : feedback.type === 'warning'
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(239, 68, 68, 0.3)'
            }`,
            color:
              feedback.type === 'success'
                ? '#6ee7b7'
                : feedback.type === 'warning'
                ? '#fcd34d'
                : '#fca5a5',
          }}
        >
          <div style={{ marginTop: '0.125rem' }}>
            {feedback.type === 'success' && <CheckCircle2 size={16} />}
            {feedback.type === 'warning' && <AlertTriangle size={16} />}
            {feedback.type === 'error' && <AlertCircle size={16} />}
          </div>
          <div style={{ flex: 1 }}>
            <div>{feedback.message}</div>
            {feedback.stats && (
              <div
                style={{
                  marginTop: '0.375rem',
                  fontSize: '0.6875rem',
                  opacity: 0.85,
                  display: 'flex',
                  gap: '0.875rem',
                }}
              >
                <span>Total: {feedback.stats.total}</span>
                <span>Entregues: {feedback.stats.sent}</span>
                {feedback.stats.failed > 0 && <span>Falhas: {feedback.stats.failed}</span>}
                {feedback.stats.cleaned > 0 && <span>Removidos (expirados): {feedback.stats.cleaned}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleImmediateSend}
          disabled={loading || countdown !== null}
          style={{
            flex: '1 1 180px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.8125rem',
            padding: '0.625rem 1rem',
            borderRadius: '0.625rem',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            opacity: loading || countdown !== null ? 0.6 : 1,
          }}
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="spin" />
              <span>Disparando aos aparelhos...</span>
            </>
          ) : (
            <>
              <Send size={14} />
              <span>Disparar Agora (Instantâneo)</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleCountdownSend}
          disabled={loading || countdown !== null}
          style={{
            flex: '1 1 180px',
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#e5e7eb',
            fontWeight: 600,
            fontSize: '0.8125rem',
            padding: '0.625rem 1rem',
            borderRadius: '0.625rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            cursor: loading || countdown !== null ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            opacity: loading || countdown !== null ? 0.6 : 1,
          }}
        >
          <Clock size={14} />
          <span>
            {countdown !== null ? `Bloqueie a tela! Disparo em ${countdown}s...` : 'Disparar em 5s (Bloqueie a tela)'}
          </span>
        </button>

        <button
          type="button"
          onClick={handleRegisterCurrentDevice}
          disabled={syncingSelf}
          style={{
            background: 'transparent',
            color: '#34d399',
            fontWeight: 600,
            fontSize: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px dashed rgba(52, 211, 153, 0.35)',
            cursor: syncingSelf ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            marginLeft: 'auto',
          }}
          title="Garante que este computador ou smartphone esteja inscrito na lista de envio"
        >
          {syncingSelf ? <RefreshCw size={13} className="spin" /> : <Smartphone size={13} />}
          <span>{syncingSelf ? 'Conectando...' : 'Inscrever este Aparelho'}</span>
        </button>
      </div>
    </div>
  );
}
