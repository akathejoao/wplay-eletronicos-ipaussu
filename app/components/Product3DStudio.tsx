"use client";

import React, { useEffect, useRef, useState } from "react";
import type * as Three from "three";
import type { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Product } from "@/lib/catalog";
import "./product-studio.css";

type ThreeNamespace = typeof import("three");
type RoundedBoxConstructor = typeof RoundedBoxGeometry;
type ProductModel = "scooter" | "perfume" | "speaker" | "headphones" | "charger" | "magsafe" | "watch" | "earbuds" | "generic";

type RotationState = {
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  reducedMotion: boolean;
};

type DragState = {
  pointerId: number;
  lastX: number;
  lastY: number;
};

function productModel(product: Product, variant: string): ProductModel {
  const searchText = `${product.id} ${product.name} ${product.category}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const variantText = variant.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (searchText.includes("scooter") || searchText.includes("mobilidade")) return "scooter";
  if (searchText.includes("perfume")) return "perfume";
  if (searchText.includes("speaker") || searchText.includes("caixa") || searchText.includes("audio")) return "speaker";
  if (searchText.includes("smartwatch") || searchText.includes("wearable")) {
    return variantText.includes("earbud") || variantText.includes("fone") ? "earbuds" : "watch";
  }
  if (searchText.includes("fone") || searchText.includes("headphone")) {
    if (variantText.includes("magsafe") || variantText.includes("mag safe")) return "magsafe";
    if (variantText.includes("fonte") || variantText.includes("carregador") || variantText.includes("usb-c")) return "charger";
    return "headphones";
  }
  if (searchText.includes("acessor")) {
    if (variantText.includes("magsafe") || variantText.includes("mag safe")) return "magsafe";
    if (variantText.includes("fonte") || variantText.includes("carregador") || variantText.includes("usb-c")) return "charger";
    if (variantText.includes("earbud") || variantText.includes("fone")) return "earbuds";
    if (variantText.includes("smartwatch") || variantText.includes("relogio") || variantText.includes("caixa 45") || variantText.includes("caixa 49")) return "watch";
    if (variantText.includes("over-ear") || variantText.includes("anc")) return "headphones";
  }
  return "generic";
}

function standardMaterial(
  three: ThreeNamespace,
  color: string,
  roughness = 0.48,
  metalness = 0.12
): Three.MeshStandardMaterial {
  return new three.MeshStandardMaterial({ color, roughness, metalness });
}

function addMesh(
  three: ThreeNamespace,
  parent: Three.Object3D,
  geometry: Three.BufferGeometry,
  material: Three.Material,
  position: [number, number, number],
  rotation?: [number, number, number]
): Three.Mesh {
  const mesh = new three.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBox(
  three: ThreeNamespace,
  parent: Three.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: Three.Material,
  rotation?: [number, number, number]
): Three.Mesh {
  return addMesh(three, parent, new three.BoxGeometry(size[0], size[1], size[2]), material, position, rotation);
}

function addRoundedBox(
  three: ThreeNamespace,
  roundedBoxConstructor: RoundedBoxConstructor,
  parent: Three.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  radius: number,
  material: Three.Material,
  rotation?: [number, number, number]
): Three.Mesh {
  const smallestSide = Math.min(size[0], size[1], size[2]);
  const geometry = new roundedBoxConstructor(size[0], size[1], size[2], 4, Math.min(radius, smallestSide * 0.48));
  return addMesh(three, parent, geometry, material, position, rotation);
}

function addCylinderBetween(
  three: ThreeNamespace,
  parent: Three.Object3D,
  start: [number, number, number],
  end: [number, number, number],
  startRadius: number,
  endRadius: number,
  material: Three.Material,
  radialSegments = 20
): Three.Mesh {
  const startPoint = new three.Vector3(start[0], start[1], start[2]);
  const endPoint = new three.Vector3(end[0], end[1], end[2]);
  const direction = new three.Vector3().subVectors(endPoint, startPoint);
  const geometry = new three.CylinderGeometry(endRadius, startRadius, direction.length(), radialSegments);
  const mesh = addMesh(three, parent, geometry, material, [0, 0, 0]);
  mesh.position.copy(startPoint).add(endPoint).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new three.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function addTube(
  three: ThreeNamespace,
  parent: Three.Object3D,
  points: Three.Vector3[],
  radius: number,
  material: Three.Material,
  segments = 48
): Three.Mesh {
  const curve = new three.CatmullRomCurve3(points);
  return addMesh(three, parent, new three.TubeGeometry(curve, segments, radius, 10, false), material, [0, 0, 0]);
}

function addCircle(
  three: ThreeNamespace,
  parent: Three.Object3D,
  radius: number,
  position: [number, number, number],
  material: Three.Material,
  segments = 48
): Three.Mesh {
  return addMesh(three, parent, new three.CircleGeometry(radius, segments), material, position);
}

function roundedBottleShape(three: ThreeNamespace, width: number, height: number): Three.Shape {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corner = Math.min(0.18, halfWidth * 0.28, halfHeight * 0.22);
  const shape = new three.Shape();
  shape.moveTo(-halfWidth + corner, -halfHeight);
  shape.lineTo(halfWidth - corner, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + corner);
  shape.lineTo(halfWidth, halfHeight - corner);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - corner, halfHeight);
  shape.lineTo(-halfWidth + corner, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - corner);
  shape.lineTo(-halfWidth, -halfHeight + corner);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + corner, -halfHeight);
  return shape;
}

function createScooter(
  three: ThreeNamespace,
  parent: Three.Object3D,
  roundedBoxConstructor: RoundedBoxConstructor,
  variant: string
): void {
  const isFatTire = /fat/i.test(variant);
  const isDoubleSeat = /duplo/i.test(variant);
  const tireRadius = isFatTire ? 0.43 : 0.32;
  const tireThickness = isFatTire ? 0.17 : 0.105;
  const tireMaterial = standardMaterial(three, "#171b19", 0.82, 0.06);
  const rubberHighlight = standardMaterial(three, "#343a36", 0.65, 0.08);
  const frameMaterial = standardMaterial(three, "#b9c2bb", 0.3, 0.82);
  const darkFrame = standardMaterial(three, "#252b27", 0.38, 0.62);
  const accentMaterial = standardMaterial(three, "#c7f450", 0.32, 0.36);
  const seatMaterial = standardMaterial(three, "#111513", 0.64, 0.04);
  const wheelPositions = [-1.16, 1.16];

  wheelPositions.forEach((wheelPosition, wheelIndex) => {
    const wheel = addMesh(
      three,
      parent,
      new three.TorusGeometry(tireRadius, tireThickness, 18, 64),
      tireMaterial,
      [0, tireRadius + 0.12, wheelPosition],
      [0, Math.PI / 2, 0]
    );
    wheel.castShadow = true;
    addMesh(
      three,
      parent,
      new three.CylinderGeometry(tireRadius * 0.58, tireRadius * 0.58, 0.3, 32),
      rubberHighlight,
      [0, tireRadius + 0.12, wheelPosition],
      [0, 0, Math.PI / 2]
    );
    [-0.17, 0.17].forEach((axleOffset) => {
      addMesh(
        three,
        parent,
        new three.CylinderGeometry(tireRadius * 0.3, tireRadius * 0.3, 0.035, 32),
        frameMaterial,
        [axleOffset, tireRadius + 0.12, wheelPosition],
        [0, 0, Math.PI / 2]
      );
    });
    const fender = addMesh(
      three,
      parent,
      new three.TorusGeometry(tireRadius + tireThickness * 0.28, 0.035, 10, 56, Math.PI),
      darkFrame,
      [0, tireRadius + 0.15, wheelPosition],
      [0, Math.PI / 2, 0]
    );
    fender.rotation.y = Math.PI / 2;
    if (wheelIndex === 0) {
      addBox(three, parent, [0.52, 0.16, 1.3], [0, tireRadius * 1.55, -0.7], darkFrame);
    }
  });

  addRoundedBox(three, roundedBoxConstructor, parent, [0.52, 0.18, 1.9], [0, 0.83, 0.08], 0.07, darkFrame);
  addRoundedBox(three, roundedBoxConstructor, parent, [0.45, 0.045, 1.55], [0, 0.94, 0.08], 0.02, accentMaterial);
  addCylinderBetween(three, parent, [0, 0.88, -0.89], [0, 2.03, -1.02], 0.075, 0.06, frameMaterial);
  addCylinderBetween(three, parent, [0, 0.94, -0.77], [0, 2.0, -0.92], 0.11, 0.095, darkFrame);
  addRoundedBox(three, roundedBoxConstructor, parent, [1.03, 0.14, 0.18], [0, 2.06, -0.94], 0.06, frameMaterial);
  addCylinderBetween(three, parent, [-0.57, 2.06, -0.94], [-0.35, 2.06, -0.94], 0.055, 0.055, seatMaterial);
  addCylinderBetween(three, parent, [0.35, 2.06, -0.94], [0.57, 2.06, -0.94], 0.055, 0.055, seatMaterial);

  addCylinderBetween(three, parent, [0, 0.91, 0.45], [0, 1.55, 0.48], 0.07, 0.055, frameMaterial);
  addRoundedBox(three, roundedBoxConstructor, parent, [0.78, 0.17, 0.38], [0, 1.61, 0.53], 0.08, seatMaterial);
  addRoundedBox(three, roundedBoxConstructor, parent, [0.66, 0.035, 0.26], [0, 1.71, 0.53], 0.02, standardMaterial(three, "#323a35", 0.54, 0.08));
  if (isDoubleSeat) {
    addCylinderBetween(three, parent, [0, 0.9, 0.78], [0, 1.36, 0.9], 0.06, 0.05, frameMaterial);
    addRoundedBox(three, roundedBoxConstructor, parent, [0.7, 0.15, 0.34], [0, 1.43, 0.94], 0.07, seatMaterial);
  }

  addRoundedBox(three, roundedBoxConstructor, parent, [0.38, 0.32, 0.08], [0, 1.77, -0.92], 0.04, standardMaterial(three, "#0b1110", 0.28, 0.12));
  addRoundedBox(three, roundedBoxConstructor, parent, [0.23, 0.14, 0.025], [0, 1.78, -0.872], 0.03, standardMaterial(three, "#7df4c5", 0.18, 0.1));
}

function createPerfume(
  three: ThreeNamespace,
  parent: Three.Object3D,
  roundedBoxConstructor: RoundedBoxConstructor,
  variant: string
): void {
  const isArab = /arab|importad/i.test(variant);
  const liquidColor = isArab ? "#b9671b" : /masculin|amadeir/i.test(variant) ? "#c4853b" : "#d2a258";
  const glass = new three.MeshPhysicalMaterial({
    color: isArab ? "#d6b88a" : "#e8e6db",
    roughness: 0.13,
    metalness: 0.04,
    transmission: 0.5,
    transparent: true,
    opacity: 0.52,
    thickness: 0.6,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const liquid = new three.MeshPhysicalMaterial({ color: liquidColor, roughness: 0.18, metalness: 0.04, transparent: true, opacity: 0.78 });
  const capMaterial = standardMaterial(three, isArab ? "#c6a86b" : "#202622", 0.24, 0.78);
  const collarMaterial = standardMaterial(three, "#c8b17d", 0.22, 0.84);
  const bottleShape = roundedBottleShape(three, isArab ? 1.45 : 1.24, 1.55);
  const bottleGeometry = new three.ExtrudeGeometry(bottleShape, { depth: 0.42, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.055, bevelThickness: 0.06 });
  addMesh(three, parent, bottleGeometry, glass, [0, 1.03, -0.24]);

  const liquidShape = roundedBottleShape(three, isArab ? 1.18 : 1.0, 1.18);
  const liquidGeometry = new three.ExtrudeGeometry(liquidShape, { depth: 0.31, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.035 });
  addMesh(three, parent, liquidGeometry, liquid, [0, 0.87, -0.185]);
  addRoundedBox(three, roundedBoxConstructor, parent, [isArab ? 0.92 : 0.8, 0.34, 0.035], [0, 1.0, 0.245], 0.035, standardMaterial(three, isArab ? "#211a14" : "#eee8d9", 0.5, 0.18));
  addRoundedBox(three, roundedBoxConstructor, parent, [0.2, 0.2, 0.2], [0, 1.87, 0], 0.025, collarMaterial);
  addCylinderBetween(three, parent, [0, 1.94, 0], [0, 2.07, 0], 0.13, 0.13, collarMaterial, 40);
  addRoundedBox(three, roundedBoxConstructor, parent, [0.54, 0.48, 0.48], [0, 2.29, 0], 0.08, capMaterial);
  addRoundedBox(three, roundedBoxConstructor, parent, [0.56, 0.055, 0.49], [0, 2.08, 0], 0.025, standardMaterial(three, "#d2bd8e", 0.2, 0.72));
}

function createSpeaker(
  three: ThreeNamespace,
  parent: Three.Object3D,
  roundedBoxConstructor: RoundedBoxConstructor,
  variant: string
): void {
  const isParty = /party|grave turbo/i.test(variant);
  const shellMaterial = standardMaterial(three, isParty ? "#202722" : "#222923", 0.54, 0.38);
  const grilleMaterial = standardMaterial(three, "#101512", 0.72, 0.14);
  const rimMaterial = standardMaterial(three, "#778179", 0.3, 0.82);
  const accentMaterial = standardMaterial(three, "#c7f450", 0.32, 0.36);
  const bodySize: [number, number, number] = isParty ? [1.72, 2.24, 1.02] : [2.5, 1.18, 0.82];
  addRoundedBox(three, roundedBoxConstructor, parent, bodySize, [0, isParty ? 1.15 : 0.76, 0], 0.24, shellMaterial);
  if (isParty) {
    addRoundedBox(three, roundedBoxConstructor, parent, [1.1, 0.12, 0.48], [0, 2.32, -0.02], 0.06, shellMaterial);
    addBox(three, parent, [0.12, 0.3, 0.12], [0, 2.15, -0.03], rimMaterial);
  }
  const centerY = isParty ? 1.18 : 0.78;
  const driverRadius = isParty ? 0.49 : 0.36;
  const driverPositions = isParty ? [[0, centerY, 0.54]] : [[-0.58, centerY, 0.43], [0.58, centerY, 0.43]];
  driverPositions.forEach((driverPosition) => {
    const position = driverPosition as [number, number, number];
    addCircle(three, parent, driverRadius, position, grilleMaterial, 56);
    addMesh(three, parent, new three.TorusGeometry(driverRadius, 0.035, 12, 56), rimMaterial, position);
    addMesh(three, parent, new three.TorusGeometry(driverRadius * 0.66, 0.018, 10, 48), accentMaterial, [position[0], position[1], position[2] + 0.008]);
    addCircle(three, parent, driverRadius * 0.36, [position[0], position[1], position[2] + 0.012], standardMaterial(three, "#333d37", 0.38, 0.54), 40);
  });
  const grilleDots = isParty ? 8 : 6;
  for (let rowIndex = 0; rowIndex < grilleDots; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < (isParty ? 5 : 11); columnIndex += 1) {
      const xPosition = isParty ? (columnIndex - 2) * 0.105 : (columnIndex - 5) * 0.095;
      const yPosition = isParty ? centerY - 0.43 + rowIndex * 0.12 : 0.25 + rowIndex * 0.1;
      addMesh(three, parent, new three.SphereGeometry(0.012, 8, 8), rimMaterial, [xPosition, yPosition, isParty ? 0.532 : 0.416]);
    }
  }
  addRoundedBox(three, roundedBoxConstructor, parent, [isParty ? 0.9 : 0.54, 0.085, 0.14], [0, isParty ? 2.37 : 1.38, 0.08], 0.04, accentMaterial);
  [-1, 1].forEach((side) => {
    addCircle(three, parent, isParty ? 0.38 : 0.31, [side * (isParty ? 0.87 : 1.24), centerY, 0], standardMaterial(three, "#151a17", 0.7, 0.12), 48);
    addMesh(three, parent, new three.TorusGeometry(isParty ? 0.38 : 0.31, 0.03, 10, 48), rimMaterial, [side * (isParty ? 0.87 : 1.24), centerY, 0]);
  });
}

function createHeadphones(
  three: ThreeNamespace,
  parent: Three.Object3D,
  roundedBoxConstructor: RoundedBoxConstructor
): void {
  const headbandMaterial = standardMaterial(three, "#252a27", 0.3, 0.72);
  const cushionMaterial = standardMaterial(three, "#111513", 0.76, 0.04);
  const cupMaterial = standardMaterial(three, "#414943", 0.32, 0.74);
  const accentMaterial = standardMaterial(three, "#c7f450", 0.28, 0.48);
  addTube(three, parent, [
    new three.Vector3(-0.68, 1.02, 0),
    new three.Vector3(-0.68, 1.62, 0),
    new three.Vector3(-0.44, 1.98, 0),
    new three.Vector3(0, 2.11, 0),
    new three.Vector3(0.44, 1.98, 0),
    new three.Vector3(0.68, 1.62, 0),
    new three.Vector3(0.68, 1.02, 0),
  ], 0.105, headbandMaterial, 60);
  addTube(three, parent, [new three.Vector3(-0.54, 1.77, 0.015), new three.Vector3(0, 2.0, 0.02), new three.Vector3(0.54, 1.77, 0.015)], 0.035, accentMaterial, 28);
  [-1, 1].forEach((side) => {
    addRoundedBox(three, roundedBoxConstructor, parent, [0.48, 0.76, 0.3], [side * 0.7, 0.97, 0.02], 0.19, cupMaterial);
    addRoundedBox(three, roundedBoxConstructor, parent, [0.54, 0.82, 0.14], [side * 0.7, 0.97, 0.2], 0.22, cushionMaterial);
    addMesh(three, parent, new three.CylinderGeometry(0.18, 0.18, 0.035, 40), accentMaterial, [side * 0.7, 0.97, 0.284], [Math.PI / 2, 0, 0]);
    addMesh(three, parent, new three.CircleGeometry(0.14, 40), cupMaterial, [side * 0.7, 0.97, 0.305]);
    addCylinderBetween(three, parent, [side * 0.67, 1.3, 0], [side * 0.67, 1.66, 0], 0.055, 0.05, headbandMaterial);
  });
}

function createCharger(
  three: ThreeNamespace,
  parent: Three.Object3D,
  roundedBoxConstructor: RoundedBoxConstructor,
  variant: string
): void {
  const isDark = /preto|black/i.test(variant);
  const shellMaterial = standardMaterial(three, isDark ? "#292e2b" : "#e8ebe5", 0.28, 0.1);
  const portMaterial = standardMaterial(three, "#101411", 0.28, 0.42);
  const metalMaterial = standardMaterial(three, "#bac3bc", 0.24, 0.86);
  addRoundedBox(three, roundedBoxConstructor, parent, [0.86, 1.0, 0.66], [0, 0.85, 0], 0.15, shellMaterial);
  addRoundedBox(three, roundedBoxConstructor, parent, [0.25, 0.1, 0.028], [0, 0.88, 0.338], 0.035, portMaterial);
  addRoundedBox(three, roundedBoxConstructor, parent, [0.18, 0.032, 0.025], [0, 0.88, 0.355], 0.01, standardMaterial(three, "#4b9d77", 0.32, 0.18));
  [-0.19, 0.19].forEach((side) => {
    addRoundedBox(three, roundedBoxConstructor, parent, [0.11, 0.4, 0.08], [side, 1.55, -0.13], 0.035, metalMaterial);
  });
  addRoundedBox(three, roundedBoxConstructor, parent, [0.44, 0.12, 0.025], [0, 0.48, 0.337], 0.04, standardMaterial(three, "#c7f450", 0.38, 0.12));
}

function createMagSafe(
  three: ThreeNamespace,
  parent: Three.Object3D,
  roundedBoxConstructor: RoundedBoxConstructor
): void {
  const bodyMaterial = standardMaterial(three, "#222824", 0.32, 0.68);
  const faceMaterial = standardMaterial(three, "#e3e6e0", 0.26, 0.08);
  const metalMaterial = standardMaterial(three, "#aeb7af", 0.25, 0.86);
  addMesh(three, parent, new three.CylinderGeometry(0.48, 0.48, 0.12, 64), bodyMaterial, [0, 1.55, 0.08], [Math.PI / 2, 0, 0]);
  addMesh(three, parent, new three.CylinderGeometry(0.4, 0.4, 0.018, 64), faceMaterial, [0, 1.55, 0.151], [Math.PI / 2, 0, 0]);
  addMesh(three, parent, new three.TorusGeometry(0.28, 0.012, 8, 64), metalMaterial, [0, 1.55, 0.165]);
  addCylinderBetween(three, parent, [0, 0.36, -0.05], [0, 1.36, -0.02], 0.075, 0.06, metalMaterial);
  addMesh(three, parent, new three.CylinderGeometry(0.42, 0.45, 0.12, 48), bodyMaterial, [0, 0.12, 0], [0, 0, 0]);
  addTube(three, parent, [new three.Vector3(0, 0.08, -0.34), new three.Vector3(0, -0.08, -0.5), new three.Vector3(0.3, -0.08, -0.68), new three.Vector3(0.42, -0.08, -0.9)], 0.035, standardMaterial(three, "#d9ddd8", 0.4, 0.05), 32);
  addRoundedBox(three, roundedBoxConstructor, parent, [0.32, 0.045, 0.2], [0, 1.92, -0.04], 0.02, standardMaterial(three, "#c7f450", 0.3, 0.1));
}

function createWatch(
  three: ThreeNamespace,
  parent: Three.Object3D,
  roundedBoxConstructor: RoundedBoxConstructor,
  variant: string
): void {
  const isUltra = /49|ultra/i.test(variant);
  const caseWidth = isUltra ? 0.98 : 0.85;
  const caseHeight = isUltra ? 1.05 : 0.91;
  const caseMaterial = standardMaterial(three, isUltra ? "#b2b8b4" : "#c7cbc5", 0.23, 0.88);
  const bandMaterial = standardMaterial(three, "#242a26", 0.55, 0.24);
  const screenMaterial = standardMaterial(three, "#101714", 0.18, 0.2);
  addRoundedBox(three, roundedBoxConstructor, parent, [caseWidth * 0.84, 0.88, 0.25], [0, 1.14, 0], 0.19, bandMaterial);
  addRoundedBox(three, roundedBoxConstructor, parent, [caseWidth * 0.84, 0.86, 0.25], [0, 0.11, 0], 0.19, bandMaterial);
  addRoundedBox(three, roundedBoxConstructor, parent, [caseWidth, caseHeight, 0.34], [0, 1.13, 0.03], 0.18, caseMaterial);
  addRoundedBox(three, roundedBoxConstructor, parent, [caseWidth * 0.82, caseHeight * 0.82, 0.06], [0, 1.13, 0.225], 0.14, standardMaterial(three, "#111613", 0.2, 0.48));
  addRoundedBox(three, roundedBoxConstructor, parent, [caseWidth * 0.72, caseHeight * 0.72, 0.025], [0, 1.13, 0.27], 0.11, screenMaterial);
  addMesh(three, parent, new three.CircleGeometry(0.24, 48), standardMaterial(three, "#c7f450", 0.3, 0.24), [0, 1.13, 0.289]);
  addMesh(three, parent, new three.CircleGeometry(0.19, 48), screenMaterial, [0, 1.13, 0.294]);
  addBox(three, parent, [0.027, 0.26, 0.014], [0, 1.25, 0.31], standardMaterial(three, "#f3f6ef", 0.3, 0.12));
  addBox(three, parent, [0.2, 0.025, 0.014], [0.1, 1.08, 0.31], standardMaterial(three, "#f3f6ef", 0.3, 0.12));
  addCylinderBetween(three, parent, [caseWidth * 0.5, 1.17, 0], [caseWidth * 0.62, 1.17, 0], 0.105, 0.105, caseMaterial, 32);
  addRoundedBox(three, roundedBoxConstructor, parent, [0.12, 0.21, 0.1], [caseWidth * 0.56, 1.42, 0], 0.035, caseMaterial);
  [-1, 1].forEach((side) => {
    addBox(three, parent, [caseWidth * 0.74, 0.08, 0.3], [0, side > 0 ? 1.66 : 0.59, 0], bandMaterial);
  });
}

function createEarbuds(
  three: ThreeNamespace,
  parent: Three.Object3D,
  roundedBoxConstructor: RoundedBoxConstructor
): void {
  const caseMaterial = standardMaterial(three, "#e7e9e4", 0.26, 0.08);
  const stemMaterial = standardMaterial(three, "#f4f5f0", 0.2, 0.06);
  const darkMaterial = standardMaterial(three, "#222a25", 0.32, 0.34);
  addRoundedBox(three, roundedBoxConstructor, parent, [1.45, 0.72, 0.72], [0, 0.45, 0], 0.25, caseMaterial);
  addRoundedBox(three, roundedBoxConstructor, parent, [1.38, 0.19, 0.67], [0, 0.87, 0.015], 0.12, standardMaterial(three, "#d7dbd4", 0.3, 0.08));
  addBox(three, parent, [1.15, 0.025, 0.68], [0, 0.77, 0.02], standardMaterial(three, "#9da69d", 0.38, 0.1));
  [-1, 1].forEach((side) => {
    addMesh(three, parent, new three.SphereGeometry(0.18, 24, 20), stemMaterial, [side * 0.32, 1.18, 0.04]);
    addRoundedBox(three, roundedBoxConstructor, parent, [0.11, 0.36, 0.13], [side * 0.32, 0.98, 0.08], 0.05, stemMaterial);
    addMesh(three, parent, new three.SphereGeometry(0.1, 20, 16), darkMaterial, [side * 0.32, 1.21, 0.16]);
  });
  addMesh(three, parent, new three.SphereGeometry(0.035, 12, 10), standardMaterial(three, "#c7f450", 0.35, 0.1), [0, 0.48, 0.368]);
}

function createGenericProduct(
  three: ThreeNamespace,
  parent: Three.Object3D,
  roundedBoxConstructor: RoundedBoxConstructor
): void {
  const shellMaterial = standardMaterial(three, "#303832", 0.38, 0.48);
  const darkMaterial = standardMaterial(three, "#111713", 0.32, 0.22);
  const accentMaterial = standardMaterial(three, "#c7f450", 0.28, 0.36);
  addRoundedBox(three, roundedBoxConstructor, parent, [1.5, 1.42, 0.62], [0, 0.93, 0], 0.22, shellMaterial);
  addRoundedBox(three, roundedBoxConstructor, parent, [1.14, 0.9, 0.08], [0, 0.95, 0.35], 0.12, darkMaterial);
  addMesh(three, parent, new three.TorusGeometry(0.32, 0.045, 12, 48), accentMaterial, [0, 0.95, 0.405]);
  addCircle(three, parent, 0.22, [0, 0.95, 0.41], standardMaterial(three, "#313a34", 0.3, 0.5));
}

function buildProduct(
  three: ThreeNamespace,
  roundedBoxConstructor: RoundedBoxConstructor,
  product: Product,
  variant: string
): Three.Group {
  const productGroup = new three.Group();
  switch (productModel(product, variant)) {
    case "scooter":
      createScooter(three, productGroup, roundedBoxConstructor, variant);
      break;
    case "perfume":
      createPerfume(three, productGroup, roundedBoxConstructor, variant);
      break;
    case "speaker":
      createSpeaker(three, productGroup, roundedBoxConstructor, variant);
      break;
    case "headphones":
      createHeadphones(three, productGroup, roundedBoxConstructor);
      break;
    case "charger":
      createCharger(three, productGroup, roundedBoxConstructor, variant);
      break;
    case "magsafe":
      createMagSafe(three, productGroup, roundedBoxConstructor);
      break;
    case "watch":
      createWatch(three, productGroup, roundedBoxConstructor, variant);
      break;
    case "earbuds":
      createEarbuds(three, productGroup, roundedBoxConstructor);
      break;
    default:
      createGenericProduct(three, productGroup, roundedBoxConstructor);
  }
  return productGroup;
}

function normalizedDegrees(radians: number): number {
  let degrees = (radians * 180) / Math.PI;
  while (degrees > 180) degrees -= 360;
  while (degrees < -180) degrees += 360;
  return Math.round(degrees);
}

function angleDistance(firstAngle: number, secondAngle: number): number {
  return Math.abs((((firstAngle - secondAngle) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
}

export type Product3DStudioProps = {
  product: Product;
  variant: string;
};

export function Product3DStudio({ product, variant }: Product3DStudioProps) {
  const initialYaw = productModel(product, variant) === "scooter" ? Math.PI / 3 : 0.48;
  const rendererHostRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef<RotationState>({
    currentX: -0.1,
    currentY: initialYaw,
    targetX: -0.1,
    targetY: initialYaw,
    reducedMotion: false,
  });
  const dragRef = useRef<DragState | null>(null);
  const [angleDegrees, setAngleDegrees] = useState(normalizedDegrees(initialYaw));
  const [webglUnavailable, setWebglUnavailable] = useState(true);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => {
      rotationRef.current.reducedMotion = motionPreference.matches;
      if (motionPreference.matches) {
        rotationRef.current.currentX = rotationRef.current.targetX;
        rotationRef.current.currentY = rotationRef.current.targetY;
      }
    };
    syncMotionPreference();
    motionPreference.addEventListener("change", syncMotionPreference);
    return () => motionPreference.removeEventListener("change", syncMotionPreference);
  }, []);

  useEffect(() => {
    let isDisposed = false;
    let animationFrameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: Three.WebGLRenderer | null = null;
    let scene: Three.Scene | null = null;
    let camera: Three.PerspectiveCamera | null = null;
    let productGroup: Three.Group | null = null;
    let previousFrameTime = 0;
    let contextLostHandler: ((event: Event) => void) | null = null;
    const canvasHost = rendererHostRef.current;

    const startScene = async () => {
      if (!canvasHost) return;
      try {
        const [three, geometryModule] = await Promise.all([
          import("three"),
          import("three/addons/geometries/RoundedBoxGeometry.js"),
        ]);
        if (isDisposed || !canvasHost) return;

        scene = new three.Scene();
        scene.background = new three.Color("#111510");
        camera = new three.PerspectiveCamera(34, 1, 0.1, 50);
        camera.position.set(0.2, 2.65, 7.6);
        camera.lookAt(0, 1.0, 0);

        rotationGroup = new three.Group();
        productGroup = buildProduct(three, geometryModule.RoundedBoxGeometry, product, variant);
        rotationGroup.add(productGroup);
        scene.add(rotationGroup);

        const ambientLight = new three.HemisphereLight("#e5f5e7", "#22291f", 2.15);
        scene.add(ambientLight);
        const keyLight = new three.DirectionalLight("#f1f8e8", 4.2);
        keyLight.position.set(-3.5, 6, 5);
        scene.add(keyLight);
        const rimLight = new three.DirectionalLight("#b9f45a", 3.1);
        rimLight.position.set(4, 3, -4);
        scene.add(rimLight);
        const fillLight = new three.PointLight("#71dcb0", 1.2, 12);
        fillLight.position.set(2, 1.2, 4);
        scene.add(fillLight);

        const groundGlow = new three.Mesh(
          new three.CircleGeometry(1, 56),
          new three.MeshBasicMaterial({ color: "#9dd444", transparent: true, opacity: 0.12, depthWrite: false })
        );
        groundGlow.rotation.x = -Math.PI / 2;
        groundGlow.position.set(0, -0.015, 0);
        groundGlow.scale.set(2.1, 1.35, 1);
        scene.add(groundGlow);

        renderer = new three.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = three.SRGBColorSpace;
        renderer.toneMapping = three.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = three.PCFSoftShadowMap;
        renderer.domElement.setAttribute("aria-hidden", "true");
        canvasHost.replaceChildren(renderer.domElement);

        contextLostHandler = (event: Event) => {
          event.preventDefault();
          setWebglUnavailable(true);
        };
        renderer.domElement.addEventListener("webglcontextlost", contextLostHandler);

        const resizeRenderer = () => {
          if (!renderer || !camera || !canvasHost) return;
          const bounds = canvasHost.getBoundingClientRect();
          const width = Math.max(1, Math.round(bounds.width));
          const height = Math.max(1, Math.round(bounds.height));
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resizeObserver = new ResizeObserver(resizeRenderer);
        resizeObserver.observe(canvasHost);
        resizeRenderer();
        previousFrameTime = performance.now();

        const renderFrame = () => {
          if (isDisposed || !renderer || !scene || !camera) return;
          const rotation = rotationRef.current;
          const currentFrameTime = performance.now();
          const elapsedSeconds = Math.min((currentFrameTime - previousFrameTime) / 1000, 0.05);
          previousFrameTime = currentFrameTime;
          const blend = rotation.reducedMotion ? 1 : 1 - Math.exp(-11 * elapsedSeconds);
          rotation.currentX += (rotation.targetX - rotation.currentX) * blend;
          let yawDifference = rotation.targetY - rotation.currentY;
          yawDifference = ((yawDifference + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          rotation.currentY += yawDifference * blend;
          if (rotationGroup) {
            rotationGroup.rotation.x = rotation.currentX;
            rotationGroup.rotation.y = rotation.currentY;
          }
          renderer.render(scene, camera);
          animationFrameId = window.requestAnimationFrame(renderFrame);
        };

        setWebglUnavailable(false);
        animationFrameId = window.requestAnimationFrame(renderFrame);
      } catch {
        if (!isDisposed) setWebglUnavailable(true);
      }
    };

    let rotationGroup: Three.Group | null = null;
    const sceneInitialization = startScene();
    void sceneInitialization;

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      if (renderer && contextLostHandler) renderer.domElement.removeEventListener("webglcontextlost", contextLostHandler);
      if (renderer && scene) {
        const geometries = new Set<Three.BufferGeometry>();
        const materials = new Set<Three.Material>();
        scene.traverse((object) => {
          const mesh = object as Three.Mesh;
          if (!mesh.isMesh) return;
          if (mesh.geometry) geometries.add(mesh.geometry);
          const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          meshMaterials.forEach((material) => materials.add(material));
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      }
      canvasHost?.replaceChildren();
    };
  }, [product.id, product.name, product.category, product.image, variant]);

  const setPose = (yaw: number, pitch: number) => {
    const rotation = rotationRef.current;
    rotation.targetY = yaw;
    rotation.targetX = pitch;
    if (rotation.reducedMotion) {
      rotation.currentY = yaw;
      rotation.currentX = pitch;
    }
    setAngleDegrees(normalizedDegrees(yaw));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRef.current;
    if (activeDrag && activeDrag.pointerId === event.pointerId) {
      const rotation = rotationRef.current;
      rotation.targetY += (event.clientX - activeDrag.lastX) * 0.012;
      rotation.targetX = Math.max(-0.58, Math.min(0.58, rotation.targetX + (event.clientY - activeDrag.lastY) * 0.008));
      activeDrag.lastX = event.clientX;
      activeDrag.lastY = event.clientY;
      if (rotation.reducedMotion) {
        rotation.currentY = rotation.targetY;
        rotation.currentX = rotation.targetX;
      }
      setAngleDegrees(normalizedDegrees(rotation.targetY));
      return;
    }

    const rotation = rotationRef.current;
    if (rotation.reducedMotion || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const horizontalPosition = (event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5;
    const verticalPosition = (event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5;
    rotation.targetY = initialYaw + horizontalPosition * 0.32;
    rotation.targetX = -0.1 - verticalPosition * 0.16;
    setAngleDegrees(normalizedDegrees(rotation.targetY));
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handlePointerLeave = () => {
    const rotation = rotationRef.current;
    if (dragRef.current || rotation.reducedMotion) return;
    rotation.targetY = initialYaw;
    rotation.targetX = -0.1;
    setAngleDegrees(normalizedDegrees(rotation.targetY));
  };

  const handleAngleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPose((Number(event.currentTarget.value) * Math.PI) / 180, rotationRef.current.targetX);
  };

  const activeModel = productModel(product, variant);
  const productCaption = activeModel === "generic" ? product.category : {
    scooter: "Mobilidade",
    perfume: "Perfumaria",
    speaker: "Áudio",
    headphones: "Áudio sem fio",
    charger: "Carregamento",
    magsafe: "MagSafe",
    watch: "Smartwatch",
    earbuds: "Earbuds",
  }[activeModel];

  return (
    <section className="product-studio" aria-label={`Modelo tridimensional ilustrativo de ${product.name}`}>
      <div className="product-studio__scene-header">
        <span className="product-studio__eyebrow">{productCaption}</span>
        <span className="product-studio__variant">{variant}</span>
      </div>

      <div
        className={`product-studio__stage${webglUnavailable ? " is-fallback" : ""}`}
      >
        <div
          ref={rendererHostRef}
          className="product-studio__canvas"
          role="img"
          aria-label={`${product.name}, ${variant}. Arraste para girar o modelo 3D.`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onPointerLeave={handlePointerLeave}
        />
        {webglUnavailable && (
          <div className="product-studio__fallback">
            <img src={product.image} alt={product.name} />
            <span>Visualização 3D indisponível</span>
          </div>
        )}
        <div className="product-studio__ground-glow" aria-hidden="true" />
      </div>

      <div className="product-studio__controls">
        <div className="product-studio__presets" role="group" aria-label="Ângulos do produto">
          <button type="button" aria-pressed={angleDistance(rotationRef.current.targetY, 0) < 0.38} onClick={() => setPose(0, -0.08)}>Frente</button>
          <button type="button" aria-pressed={angleDistance(rotationRef.current.targetY, Math.PI / 2) < 0.38} onClick={() => setPose(Math.PI / 2, -0.04)}>Lateral</button>
          <button type="button" aria-pressed={angleDistance(rotationRef.current.targetY, Math.PI) < 0.38} onClick={() => setPose(Math.PI, -0.08)}>Verso</button>
        </div>
        <label className="product-studio__angle-control">
          <span>Ângulo</span>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={angleDegrees}
            aria-label="Girar o modelo em 360 graus"
            aria-valuetext={`${angleDegrees} graus`}
            onChange={handleAngleChange}
          />
          <output>{angleDegrees}°</output>
        </label>
      </div>
      <p className="product-studio__caption">Arraste para girar · Modelo 3D ilustrativo</p>
    </section>
  );
}
