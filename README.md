# WHYA TikTok API

Starter project Netlify Functions untuk endpoint informasi, MP4, dan MP3.

## Deploy melalui GitHub + Netlify

1. Buat repository GitHub bernama `whya-tiktok-api`.
2. Upload seluruh isi folder ini ke root repository.
3. Di Netlify pilih **Add new project** → **Import an existing project**.
4. Hubungkan repository GitHub tersebut.
5. Build settings:
   - Build command: kosong
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
6. Deploy.

## Environment variables

Tambahkan di Netlify → Site configuration → Environment variables:

- `DOWNLOADER_API`: URL HTTPS provider yang menerima POST JSON.
- `DOWNLOADER_API_KEY`: API key provider (opsional, tergantung provider).

Setelah mengubah environment variables, lakukan redeploy.

## Kontrak provider yang diharapkan

Netlify Function mengirim POST JSON:

```json
{
  "url": "https://www.tiktok.com/@akun/video/123",
  "format": "video"
}
```

`format` dapat berupa `video`, `audio`, atau `info`.

Untuk format video/audio, provider harus mengembalikan JSON:

```json
{
  "downloadUrl": "https://provider.example/path/to/file"
}
```

Untuk `info`, provider boleh mengembalikan objek JSON informasi media.

Ini adalah kerangka integrasi, bukan downloader mandiri. Tanpa provider pemrosesan media yang kompatibel dan berizin, endpoint video/audio akan mengembalikan `PROVIDER_NOT_CONFIGURED`.

## Endpoint

- `POST /api/tiktok/info`
- `POST /api/tiktok/video`
- `POST /api/tiktok/audio`
- `POST /api/tiktok` dengan body `{"url":"...","format":"video|audio|info"}`

Body request:

```json
{
  "url": "https://www.tiktok.com/@akun/video/123"
}
```

Gunakan hanya konten yang kamu miliki atau memiliki izin untuk mengunduhnya. Jangan commit API key ke GitHub.
