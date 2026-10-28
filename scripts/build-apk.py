"""Publish an existing, compiled and signed Android APK. Never fabricate an APK.

Usage: python scripts/build-apk.py path/to/app-release.apk --build-tools path/to/Android/Sdk/build-tools/35.0.0
The Android app must already be built and signed by its maintainer.
"""
import argparse
from pathlib import Path
import shutil
import subprocess
import zipfile


def publish_apk(source: Path, build_tools: Path) -> None:
    suffix = ".bat" if (build_tools / "apksigner.bat").exists() else ""
    signer = build_tools / f"apksigner{suffix}"
    aapt = build_tools / ("aapt.exe" if (build_tools / "aapt.exe").exists() else "aapt")
    if not signer.is_file() or not aapt.is_file():
        raise ValueError("Informe uma pasta Android SDK build-tools com apksigner e aapt.")
    with zipfile.ZipFile(source) as apk:
        manifest = apk.read("AndroidManifest.xml")
        if not manifest.startswith(b"\x03\x00\x08\x00"):
            raise ValueError("Manifesto Android não compilado: este arquivo não é um APK válido.")
        dex_files = [name for name in apk.namelist() if name.startswith("classes") and name.endswith(".dex")]
        if not dex_files or not apk.read(dex_files[0]).startswith(b"dex\n"):
            raise ValueError("O APK não contém código Android compilado.")
    # These official SDK tools verify the actual signature, resources and launchable activity.
    subprocess.run([str(signer), "verify", "--verbose", str(source)], check=True)
    result = subprocess.run([str(aapt), "dump", "badging", str(source)], check=True, capture_output=True, text=True)
    if "launchable-activity:" not in result.stdout:
        raise ValueError("O APK não possui uma atividade inicial executável.")
    destination = Path(__file__).resolve().parents[1] / "public/downloads/wplay-app.apk"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() != destination.resolve():
        shutil.copyfile(source, destination)
    print(f"APK compilado e com assinatura validada publicado em {destination}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--build-tools", type=Path, required=True)
    args = parser.parse_args()
    try:
        publish_apk(args.source, args.build_tools)
    except (ValueError, OSError, KeyError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        parser.exit(1, f"APK não publicado: {error}\n")
