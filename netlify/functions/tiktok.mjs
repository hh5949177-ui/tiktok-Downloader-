const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function getEnv(name) {
  return globalThis.Netlify?.env?.get?.(name) || process.env[name] || "";
}

function isTikTokUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      (host === "tiktok.com" || host.endsWith(".tiktok.com"));
  } catch {
    return false;
  }
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ success: false, message: "Gunakan metode POST." }, 405);
  }

  const pathname = new URL(request.url).pathname;
  const route = pathname.split("/").filter(Boolean).pop();
  let format = route === "audio" ? "audio" : route === "info" ? "info" : "video";

  try {
    const body = await request.json();
    const url = body?.url;

    if (typeof url !== "string" || !isTikTokUrl(url)) {
      return json({ success: false, message: "URL TikTok tidak valid." }, 400);
    }

    if (route === "tiktok" && body.format) {
      if (!["video", "audio", "info"].includes(body.format)) {
        return json({ success: false, message: "Format harus video, audio, atau info." }, 400);
      }
      format = body.format;
    }

    const provider = getEnv("DOWNLOADER_API");
    const apiKey = getEnv("DOWNLOADER_API_KEY");

    if (!provider) {
      return json({
        success: false,
        code: "PROVIDER_NOT_CONFIGURED",
        message: "Provider pemrosesan media belum dikonfigurasi."
      }, 503);
    }

    let providerUrl;
    try {
      providerUrl = new URL(provider);
    } catch {
      return json({ success: false, message: "DOWNLOADER_API bukan URL yang valid." }, 500);
    }

    if (providerUrl.protocol !== "https:") {
      return json({ success: false, message: "Provider wajib menggunakan HTTPS." }, 500);
    }

    const providerResponse = await fetch(providerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({ url, format }),
      signal: AbortSignal.timeout(25000)
    });

    if (!providerResponse.ok) {
      return json({
        success: false,
        message: "Provider gagal memproses permintaan.",
        providerStatus: providerResponse.status
      }, 502);
    }

    const result = await providerResponse.json();

    if (format === "info") {
      return json({ success: true, result });
    }

    // Kontrak provider: JSON { "downloadUrl": "https://..." }
    if (typeof result?.downloadUrl !== "string") {
      return json({
        success: false,
        message: "Respons provider tidak memiliki downloadUrl."
      }, 502);
    }

    let fileUrl;
    try {
      fileUrl = new URL(result.downloadUrl);
    } catch {
      return json({ success: false, message: "URL file dari provider tidak valid." }, 502);
    }

    if (fileUrl.protocol !== "https:") {
      return json({ success: false, message: "URL file provider wajib HTTPS." }, 502);
    }

    const fileResponse = await fetch(fileUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(25000)
    });

    if (!fileResponse.ok || !fileResponse.body) {
      return json({ success: false, message: "File tidak dapat diambil dari provider." }, 502);
    }

    const contentLength = Number(fileResponse.headers.get("content-length") || 0);
    const maxBytes = 20 * 1024 * 1024;

    if (contentLength && contentLength > maxBytes) {
      await fileResponse.body.cancel();
      return json({
        success: false,
        message: "File melebihi batas 20 MB pada konfigurasi contoh ini."
      }, 413);
    }

    const isAudio = format === "audio";
    const extension = isAudio ? "mp3" : "mp4";
    const contentType = isAudio ? "audio/mpeg" : "video/mp4";

    return new Response(fileResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="whya-${extension}.${extension}"`,
        "Cache-Control": "no-store",
        ...(contentLength ? { "Content-Length": String(contentLength) } : {})
      }
    });
  } catch (error) {
    console.error("WHYA TikTok API error:", error);
    return json({
      success: false,
      message: error?.name === "TimeoutError"
        ? "Permintaan ke provider melewati batas waktu."
        : "Terjadi kesalahan saat memproses permintaan."
    }, 500);
  }
};

export const config = {
  path: [
    "/api/tiktok",
    "/api/tiktok/video",
    "/api/tiktok/audio",
    "/api/tiktok/info"
  ],
  method: ["POST", "OPTIONS"]
};
