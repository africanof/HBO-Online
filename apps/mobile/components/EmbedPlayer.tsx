import { WebView } from "react-native-webview";
import { siteUrl } from "../lib/supabase";
import { useT } from "../lib/i18n";

/** Vídeo ou live do YouTube/Facebook dentro da APP (dentro de uma página com a origem do site, como o YouTube pede). */
export function EmbedPlayer({ src, title, width }: { src: string; title: string; width: number }) {
  const { t } = useT();
  const safe = src.replace(/"/g, "&quot;");
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#000;height:100%}iframe{border:0;width:100%;height:100%}</style></head>` +
    `<body><iframe src="${safe}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`;
  return <WebView accessibilityLabel={t("sv.watch", { title })} source={{ html, baseUrl: siteUrl }} originWhitelist={["*"]}
    allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} javaScriptEnabled
    setSupportMultipleWindows={false} style={{ width, height: width * 0.5625, borderRadius: 12, backgroundColor: "#000" }} />;
}
