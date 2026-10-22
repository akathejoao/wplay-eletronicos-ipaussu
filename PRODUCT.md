# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Next.js with Supabase for shared product, category, contact, and location data. Develop and run locally first; choose and configure web hosting after the local version is complete.

## Users

- Shoppers in Ipaussu and the surrounding region who want to browse electronics, electric scooters, perfumes, audio products, and accessories, check the physical store location on Google Maps, and ask questions or place an order through WhatsApp.
- The owner of WPlay Eletrônicos Ipaussu, who manages the public product catalog, custom product categories, store branding, contact details, and physical location from an authenticated or local admin panel.

## Product Purpose

Present WPlay's products and make it straightforward for shoppers to request availability, prices, payment options, and delivery details through WhatsApp or visit the physical store in Ipaussu. Let the owner customize categories, products, store texts, and location/contact information without changing code.

## Positioning

A local electronics and electric-mobility retailer serving Ipaussu, with customer conversations and order requests handled directly through WhatsApp and an accessible physical storefront at R. Washington Luís, 887, Ipaussu - SP.

## Operating Context

The catalog is primarily browsed on mobile. Shoppers may move from a product to a WhatsApp conversation to confirm current price, availability, payment terms, or delivery, or open the route to the physical store on Google Maps. The owner needs full admin customization: adding/removing categories, adding/editing/publishing/removing products, and updating store headlines, address, Maps links, and contact details.

## Capabilities and Constraints

- Public product catalog with default and owner-created custom categories.
- Owner-facing product, category, store-text, and store-location/contact management backed by local storage and shared online data (Supabase).
- Interactive Location section modeled after a split card + interactive Google Maps embed with direct "Ver rota no mapa" / "Abrir no Maps" actions pointing to `https://maps.app.goo.gl/nrtpoXdpveMRe4mg9`.
- Official WPlay Eletrônicos logo (`/images/wplay-logo.png`) displayed in the header, hero, location card, and admin panel.
- Confirmed street address: `R. Washington Luís, 887, Ipaussu - SP, 18950-025`.
- Confirmed Google Maps link: `https://maps.app.goo.gl/nrtpoXdpveMRe4mg9`.
- Main WhatsApp contact link: `https://wa.me/message/AYTWXK3N666EC1`.
- Instagram: `https://www.instagram.com/wplayeletronicosipaussu/`.
