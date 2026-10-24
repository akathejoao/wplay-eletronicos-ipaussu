"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Compass,
  MapPin,
  ShoppingBag,
  Smartphone,
  Sparkles,
} from "lucide-react";
import {
  defaultStoreSettings,
  handleImageErrorFallback,
  normalizeSettings,
  officialLogoPath,
  settingsStorageKey,
  StoreSettings,
} from "@/lib/catalog";

export default function NotFoundPage() {
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [attemptedPath, setAttemptedPath] = useState<string>("");

  useEffect(() => {
    try {
      setAttemptedPath(window.location.pathname || "");
      const saved = localStorage.getItem(settingsStorageKey);
      if (saved) {
        setSettings(normalizeSettings(JSON.parse(saved) as Partial<StoreSettings>));
      }
    } catch {
      // ignore storage read error
    }
  }, []);

  return (
    <main className="storefront-clean notfound-shell">
      <div className="notfound-card">
        <div className="notfound-brand">
          <span className="brand-logo-ring">
            <img
              src={settings.logo_url || officialLogoPath}
              alt="Logo WPlay Eletrônicos"
              className="brand-logo-img"
              onError={(e) => handleImageErrorFallback(e, officialLogoPath)}
            />
          </span>
          <div>
            <strong>{settings.store_name}</strong>
            <span>{settings.city}</span>
          </div>
        </div>

        <div className="notfound-badge">
          <Compass size={14} />
          <span>Redirecionamento Inteligente · Link Protegido</span>
        </div>

        <h1>Este link mudou ou foi atualizado.</h1>
        <p className="notfound-desc">
          {attemptedPath ? (
            <>
              O endereço <code>{attemptedPath}</code> não está ativo no momento, mas a vitrine
              oficial da <strong>WPlay Eletrônicos</strong> está pronta com iPhones (13 ao 18
              Pro Max), Scooters Elétricas, Perfumes e Áudio.
            </>
          ) : (
            <>
              O link acessado foi atualizado. Acesse diretamente nossa vitrine interativa ou
              fale com a equipe no WhatsApp.
            </>
          )}
        </p>

        <div className="notfound-shortcuts">
          <Link href="/#vitrine" className="notfound-tile">
            <Smartphone size={18} />
            <div>
              <strong>Ver Vitrine Completa</strong>
              <span>iPhones 3D, Scooters, Perfumes e Áudio</span>
            </div>
          </Link>

          <Link href="/#encomenda" className="notfound-tile">
            <ShoppingBag size={18} />
            <div>
              <strong>Montar Encomenda Rápida</strong>
              <span>Escolha seus itens e receba cotação no WhatsApp</span>
            </div>
          </Link>

          <Link href="/#localizacao" className="notfound-tile">
            <MapPin size={18} />
            <div>
              <strong>Visitar Loja em Ipaussu</strong>
              <span>{settings.address_line} · {settings.city}</span>
            </div>
          </Link>
        </div>

        <div className="notfound-actions">
          <Link href="/" className="button button-lime">
            <ArrowLeft size={16} /> Ir para a Vitrine Principal
          </Link>
          <a
            href={settings.whatsapp_url || defaultStoreSettings.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-outline"
          >
            <Sparkles size={15} /> Chamar no WhatsApp <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </main>
  );
}
