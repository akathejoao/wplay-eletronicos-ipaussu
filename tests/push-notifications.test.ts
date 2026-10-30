import test from "node:test";
import assert from "node:assert/strict";
import {
  getVapidPublicKey,
  getVapidPrivateKey,
  getVapidSubject,
  savePushSubscription,
  removePushSubscription,
  getAllPushSubscriptions,
  getPushSubscriberCount,
  broadcastPushNotification,
} from "../lib/push-service";
import {
  PUSH_SETTINGS_GALLERY_ID,
  PUSH_SETTINGS_GALLERY_LABEL,
} from "../lib/push-store";

test("VAPID keys are properly configured and follow standard formats", () => {
  const pub = getVapidPublicKey();
  const priv = getVapidPrivateKey();
  const sub = getVapidSubject();

  assert.ok(pub && pub.length >= 40, "Public key must be at least 40 characters");
  assert.ok(priv && priv.length >= 20, "Private key must be at least 20 characters");
  assert.ok(sub.startsWith("mailto:") || sub.startsWith("https://"), "Subject must be mailto or url");
});

test("Push subscription saving prevents duplicates by matching endpoint", async () => {
  const testEndpoint = "https://fcm.googleapis.com/fcm/send/test-token-12345";
  const testKeys = {
    p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0A3qcVIWjkh6YEBef04",
    auth: "tBHItJI5svbpez7KI4CCXg",
  };

  // Clean first if present
  await removePushSubscription(testEndpoint);

  // 1. First registration (new)
  const result1 = await savePushSubscription({
    endpoint: testEndpoint,
    keys: testKeys,
    userAgent: "Mozilla/5.0 Test Browser",
  });

  assert.equal(result1.success, true);
  assert.equal(result1.isNew, true);

  // 2. Second registration with the same endpoint (update, not duplicate)
  const result2 = await savePushSubscription({
    endpoint: testEndpoint,
    keys: testKeys,
    userAgent: "Mozilla/5.0 Test Browser Updated",
  });

  assert.equal(result2.success, true);
  assert.equal(result2.isNew, false);
  assert.equal(result1.id, result2.id, "Subscription ID must be preserved on update");

  // Verify subscriber count includes it
  const allSubs = await getAllPushSubscriptions();
  const found = allSubs.filter((s) => s.endpoint === testEndpoint);
  assert.equal(found.length, 1, "There should be exactly 1 subscription for this endpoint");

  // Clean up
  await removePushSubscription(testEndpoint);
  const afterDelete = await getAllPushSubscriptions();
  assert.equal(
    afterDelete.some((s) => s.endpoint === testEndpoint),
    false,
    "Subscription must be removed"
  );
});

test("Push subscription handles Safari iOS web.push.apple.com endpoints and updates counter", async () => {
  const appleEndpoint = "https://web.push.apple.com/QC77X-test-safari-token-ios";
  const testKeys = {
    p256dh: "BEl_zWd-apple-sample-p256dh-key-content-1234567890abcdef",
    auth: "AppleAuthToken12345",
  };

  await removePushSubscription(appleEndpoint);
  const countBefore = await getPushSubscriberCount();

  const saved = await savePushSubscription({
    endpoint: appleEndpoint,
    keys: testKeys,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15",
  });

  assert.equal(saved.success, true);

  const countAfter = await getPushSubscriberCount();
  assert.equal(countAfter, countBefore + 1, "Counter must increment by 1 when saving new iOS subscription");

  const all = await getAllPushSubscriptions();
  const found = all.find((s) => s.endpoint === appleEndpoint);
  assert.ok(found, "Apple iOS subscription must be present in store");
  assert.equal(found?.endpoint, appleEndpoint);

  // Clean up
  await removePushSubscription(appleEndpoint);
  const countCleaned = await getPushSubscriberCount();
  assert.equal(countCleaned, countBefore, "Counter must restore after cleanup");
});

test("Push subscription rejects incomplete payload", async () => {
  await assert.rejects(
    // @ts-expect-error Testing invalid input
    savePushSubscription({ endpoint: "" }),
    /PushSubscription inválido/
  );

  await assert.rejects(
    // @ts-expect-error Testing invalid keys
    savePushSubscription({ endpoint: "https://valid.endpoint", keys: { p256dh: "" } }),
    /PushSubscription inválido/
  );
});

test("Push broadcast returns stats and handles empty subscriber pool gracefully", async () => {
  const result = await broadcastPushNotification({
    title: "🔥 Oferta Relâmpago WPlay!",
    body: "Só hoje na WPlay! iPhone com desconto especial no Pix.",
    url: "/#catalogo",
  });

  assert.equal(typeof result.total, "number");
  assert.equal(typeof result.sent, "number");
  assert.equal(typeof result.failed, "number");
  assert.equal(typeof result.removed, "number");
});

test("Push store defines store_settings gallery fallback metadata for Vercel Serverless persistence", () => {
  assert.equal(PUSH_SETTINGS_GALLERY_ID, "wplay_push_subscriptions_store");
  assert.equal(PUSH_SETTINGS_GALLERY_LABEL, "WPlay Push Subscriptions Storage");
});
