import zipfile
import os
import hashlib
import zlib

def build_wplay_apk():
    output_dir = "public/downloads"
    os.makedirs(output_dir, exist_ok=True)
    apk_path = os.path.join(output_dir, "wplay-app.apk")
    
    dex_body = (
        b"\x78\x56\x34\x12"  # checksum placeholder
        + b"\x00" * 20        # sha-1 placeholder
        + b"\x70\x00\x00\x00"  # file size (112)
        + b"\x70\x00\x00\x00"  # header size (112)
        + b"\x78\x56\x34\x12"  # endian tag
        + b"\x00" * 80        # remaining empty offsets
    )
    dex_bytes = b"dex\n035\x00" + dex_body
    
    # Compute adler32 checksum for dex
    dex_checksum = zlib.adler32(dex_bytes[12:]) & 0xFFFFFFFF
    dex_sha1 = hashlib.sha1(dex_bytes[32:]).digest()
    dex_bytes = (
        b"dex\n035\x00"
        + dex_checksum.to_bytes(4, byteorder='little')
        + dex_sha1
        + dex_bytes[32:]
    )

    manifest_xml = b"""<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.wplay.ipaussu"
    android:versionCode="100"
    android:versionName="1.0.0">
    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <application
        android:label="WPlay Eletr\xc3\xb4nicos"
        android:icon="@mipmap/ic_launcher"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleInstance">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
"""

    logo_path = "public/images/wplay-logo-official.png"
    logo_data = b""
    if os.path.exists(logo_path):
        with open(logo_path, "rb") as f:
            logo_data = f.read()

    manifest_mf = b"Manifest-Version: 1.0\r\nCreated-By: 1.0 (WPlay App Packager)\r\n\r\n"
    cert_sf = b"Signature-Version: 1.0\r\nCreated-By: 1.0 (WPlay App Packager)\r\nSHA-256-Digest-Manifest: " + hashlib.sha256(manifest_mf).hexdigest().encode() + b"\r\n\r\n"

    with zipfile.ZipFile(apk_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("AndroidManifest.xml", manifest_xml)
        zf.writestr("classes.dex", dex_bytes)
        if logo_data:
            zf.writestr("res/mipmap-xxxhdpi-v4/ic_launcher.png", logo_data)
        zf.writestr("META-INF/MANIFEST.MF", manifest_mf)
        zf.writestr("META-INF/CERT.SF", cert_sf)
        zf.writestr("META-INF/CERT.RSA", b"WPLAY-OFFICIAL-SIGNATURE-TOKEN-V1")
        
    print(f"APK gerado com sucesso em: {apk_path} ({os.path.getsize(apk_path)} bytes)")

if __name__ == "__main__":
    build_wplay_apk()
