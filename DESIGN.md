---
name: WPlay
description: Vitrine local com produtos em destaque e consulta pelo WhatsApp.
colors:
  background: "#050d09"
  section: "#081c12"
  raised: "#0c2516"
  foreground: "#f3f6ef"
  muted: "#b0b6ad"
  primary: "#c7f450"
  ambient: "#1ee69f"
typography:
  display:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  control: "6px"
  product: "10px"
  dialog: "14px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
  section: "64px"
---

## Overview
Preserve WPlay's black, lime and emerald identity. The user wants expressive visual design with concise writing. Reuse the existing showroom backdrop, slow moving light and a slight pointer response while keeping the short headings, compact configuration and single store-information section.

## Colors
Lime highlights primary actions and selection. Emerald belongs to the environment, not to competing action buttons. Dark translucent surfaces protect text contrast over the showroom image. On phones the WhatsApp action sits in the header; hide the floating dock so it cannot cover catalog content.

## Typography
Use the existing display and body fonts. Product names stay readable at 14px mobile and 18px desktop. Do not add decorative technical labels above headings.

## Layout
Equal product columns with image, name, category and actions. Two columns on phones. Product configuration lives in Espiar. The order flow uses simple rows and a summary, with delivery, payment and message previews progressively disclosed. Public overrides live in app/storefront.css and are scoped to .storefront-clean, preserving the existing admin surface.

## Components
Espiar provides the product's variant selector, visual inspection and WhatsApp/order actions. Native selects keep iPhone models, compatible storage, finish and condition compact. Store details appear once beside the map; the header retains only the brand and navigation.

## Motion
Animate two ambient lighting layers using transform only, with 24s and 31s alternate cycles. Keep the showroom photograph stationary. Pointer light is updated through a client leaf and DOM references, without React updates per frame. Pause background animation when the page is hidden, a product dialog is open, the user pauses it, or reduced motion is requested. Keep forms, navigation and the current short copy stable. Section navigation uses IntersectionObserver rather than a scroll listener.

Current visual dials: DESIGN_VARIANCE 7, MOTION_INTENSITY 6, VISUAL_DENSITY 3. Jakub's readable production polish leads; Jhey's expressive background treatment is secondary. Background lighting may move, product information should not compete for attention.

## Content
Three-dimensional meshes are illustrative category models. They do not establish exact product dimensions, stock, colors or specifications. Keep the real source photograph as the WebGL fallback and label illustrative visualization clearly.
