'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Clock, Sparkles, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

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
  const [countdown, setCountdown] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    stats?: { sent: number; total: number; failed: number; cleaned: number };
  } | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const getAdminAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-admin-key': 'wplay-admin-verified',
      'x-admin-session': 'active',
    };

    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('wplay-admin-session-v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.token) {
            headers['Authorization'] = parsed.token;
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    return headers;
  };

  const executeSend = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
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
            'Aviso: Disparo concluído, mas nenhum aparelho recebeu (0 inscritos). Abra o app no iPhone ou Android e clique em "Ativar Alertas VIP" para testar ao vivo.',
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
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
          <strong>Payload de Demonstração:</strong>
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#e5e7eb', fontWeight: 600 }}>
          {DEMO_PAYLOAD.title}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginTop: '0.125rem' }}>
          {DEMO_PAYLOAD.body}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleImmediateSend}
          disabled={loading || countdown !== null}
          className="button button-lime"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.125rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            borderRadius: '0.75rem',
            cursor: loading || countdown !== null ? 'not-allowed' : 'pointer',
            opacity: loading || countdown !== null ? 0.6 : 1,
            backgroundColor: '#10b981',
            color: '#000',
            border: 'none',
          }}
        >
          {loading && countdown === null ? (
            <>
              <RefreshCw size={15} className="spin" />
              <span>Disparando...</span>
            </>
          ) : (
            <>
              <Send size={15} />
              <span>Disparar Agora</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleCountdownSend}
          disabled={loading || countdown !== null}
          className="button button-outline"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.125rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            borderRadius: '0.75rem',
            cursor: loading || countdown !== null ? 'not-allowed' : 'pointer',
            border: '1px solid rgba(52, 211, 153, 0.4)',
            color: '#34d399',
            backgroundColor: countdown !== null ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
            transition: 'all 0.2s ease',
          }}
        >
          <Clock size={15} />
          <span>
            {countdown !== null
              ? `Bloqueie o iPhone em ${countdown}s...`
              : 'Disparar em 5s (Teste de Bloqueio)'}
          </span>
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            background:
              feedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.12)'
                : feedback.type === 'warning'
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${
              feedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.3)'
                : feedback.type === 'warning'
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(239, 68, 68, 0.3)'
            }`,
            color:
              feedback.type === 'success'
                ? '#34d399'
                : feedback.type === 'warning'
                ? '#fbbf24'
                : '#f87171',
          }}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          ) : feedback.type === 'warning' ? (
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          ) : (
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          )}
          <div style={{ flex: 1 }}>
            <div>{feedback.message}</div>
            {feedback.stats && (
              <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', opacity: 0.85 }}>
                Entregues: <strong>{feedback.stats.sent}</strong> | Base total: <strong>{feedback.stats.total}</strong>
                {feedback.stats.cleaned > 0 && ` | Inscrições expiradas limpas: ${feedback.stats.cleaned}`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPushTester;
