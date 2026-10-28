import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("APK transport handles missing, empty and available artifacts, with matching GET/HEAD headers", async () => {
  const project = process.cwd();
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "wplay-download-test-"));
  try {
    process.chdir(temporaryRoot);
    const route = await import(pathToFileURL(path.join(project, "app/api/download/apk/route.ts")).href);
    const missing = await route.GET();
    assert.equal(missing.status, 503);
    assert.equal(missing.headers.get("Cache-Control"), "no-store");
    assert.equal((await route.HEAD()).status, 503);

    await mkdir("public/downloads", { recursive: true });
    await writeFile("public/downloads/wplay-app.apk", Buffer.alloc(0));
    assert.equal((await route.GET()).status, 503);

    // Transport-only fixture; this is not an installable or published Android app.
    const fixture = Buffer.from("WPLAY_DOWNLOAD_TRANSPORT_TEST");
    await writeFile("public/downloads/wplay-app.apk", fixture);
    const head = await route.HEAD();
    const response = await route.GET();
    assert.equal(head.status, 200);
    assert.equal(response.status, 200);
    assert.equal(head.headers.get("Content-Length"), String(fixture.length));
    assert.equal(response.headers.get("Content-Type"), "application/vnd.android.package-archive");
    assert.equal(response.headers.get("Content-Disposition"), 'attachment; filename="WPlay-Eletronicos.apk"');
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fixture);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
  } finally {
    process.chdir(project);
    assert.ok(path.resolve(temporaryRoot).startsWith(path.resolve(tmpdir()) + path.sep));
    assert.ok(path.basename(temporaryRoot).startsWith("wplay-download-test-"));
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
