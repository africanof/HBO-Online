"""Tira o fundo de uma foto de produto e põe um fundo branco (ou o fundo da Huambo Online).

POST /api/fundo?estilo=branco|marca
  Authorization: Bearer <sessão do utilizador no Supabase>
  corpo: a imagem (JPG, PNG ou WEBP, até 8 MB) — ou JSON {"image": "<base64>", "estilo": "..."} (APP)
Responde com a foto pronta em JPG (ou JSON {"image": "<base64>", "remaining": n} quando o pedido é JSON). Usa o modelo «silueta» do rembg (U²-Net, código aberto),
que corre aqui mesmo: não há custo por foto. Cada pessoa tem um limite diário (consume_ai('bg_remove')).
"""
import base64
import hashlib
import io
import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/silueta.onnx"
MODEL_SHA256 = "75da6c8d2f8096ec743d071951be73b4a8bc7b3e51d9a6625d63644f90ffeedb"
MODEL_PATH = "/tmp/silueta.onnx"
MAX_BYTES = 8 * 1024 * 1024
MAX_SIDE = 1600
OUT_SIDE = 1200

_session = None


def _model():
    """Carrega o modelo uma vez por instância (fica guardado em /tmp entre pedidos)."""
    global _session
    if _session is not None:
        return _session
    import onnxruntime as ort

    ok = os.path.exists(MODEL_PATH) and _sha256(MODEL_PATH) == MODEL_SHA256
    if not ok:
        tmp = MODEL_PATH + ".part"
        with urllib.request.urlopen(MODEL_URL, timeout=60) as r, open(tmp, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        if _sha256(tmp) != MODEL_SHA256:
            os.remove(tmp)
            raise RuntimeError("MODEL_CHECKSUM")
        os.replace(tmp, MODEL_PATH)
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    _session = ort.InferenceSession(MODEL_PATH, sess_options=opts, providers=["CPUExecutionProvider"])
    return _session


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def object_mask(img):
    """Máscara (0–255) do artigo principal, do tamanho da imagem."""
    sess = _model()
    small = img.convert("RGB").resize((320, 320), Image.LANCZOS)
    a = np.asarray(small, dtype=np.float32)
    a = a / max(float(a.max()), 1e-6)
    a = (a - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    a = a.transpose(2, 0, 1)[None]
    out = sess.run(None, {sess.get_inputs()[0].name: a})[0][0, 0]
    out = (out - out.min()) / (out.max() - out.min() + 1e-8)
    return Image.fromarray((out * 255).astype(np.uint8)).resize(img.size, Image.LANCZOS)


def _brand_background(size):
    """Fundo claro com um degradê suave e a marca discreta no canto."""
    w, h = size
    top = np.array([255, 255, 255], np.float32)
    bottom = np.array([232, 238, 247], np.float32)
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    grad = (top * (1 - t) + bottom * t).repeat(w, axis=1)
    bg = Image.fromarray(grad.astype(np.uint8), "RGB")
    draw = ImageDraw.Draw(bg)
    fs = max(16, w // 40)
    try:
        font = ImageFont.load_default(size=fs)
    except TypeError:
        font = ImageFont.load_default()
    text = "Huambo Online"
    box = draw.textbbox((0, 0), text, font=font)
    pad = fs
    draw.text((w - (box[2] - box[0]) - pad, h - (box[3] - box[1]) - pad), text, fill=(120, 134, 160), font=font)
    return bg


def compose(img, mask, style):
    """Recorta o artigo, centra-o num quadrado com margem e põe o fundo escolhido."""
    m = np.asarray(mask)
    ys, xs = np.where(m > 40)
    if len(xs) == 0 or len(xs) < 0.01 * m.size:
        return None
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min() + 0, ys.max() + 1
    obj = img.convert("RGB").crop((x0, y0, x1, y1))
    om = mask.crop((x0, y0, x1, y1))
    ow, oh = obj.size
    side = int(max(ow, oh) * 1.18)
    scale = min(1.0, OUT_SIDE / side)
    side = max(1, int(side * scale))
    ow2, oh2 = max(1, int(ow * scale)), max(1, int(oh * scale))
    obj = obj.resize((ow2, oh2), Image.LANCZOS)
    om = om.resize((ow2, oh2), Image.LANCZOS)
    bg = Image.new("RGB", (side, side), (255, 255, 255)) if style == "branco" else _brand_background((side, side))
    px, py = (side - ow2) // 2, (side - oh2) // 2
    if style != "branco":
        # Sombra suave por baixo do artigo.
        shadow = Image.new("L", (side, side), 0)
        shadow.paste(om.point(lambda v: int(v * 0.35)), (px + side // 80, py + side // 50))
        shadow = shadow.filter(ImageFilter.GaussianBlur(side // 60 or 1))
        bg.paste(Image.new("RGB", (side, side), (60, 70, 90)), (0, 0), shadow)
    bg.paste(obj, (px, py), om)
    return bg


def _consume_quota(token):
    """Gasta um uso do limite diário da pessoa. Devolve (restantes, erro)."""
    url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or ""
    if not url or not key:
        return None, "NOT_CONFIGURED"
    req = urllib.request.Request(
        url + "/rest/v1/rpc/consume_ai",
        data=json.dumps({"p_feature": "bg_remove"}).encode(),
        headers={"apikey": key, "Authorization": "Bearer " + token, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return int(json.loads(r.read() or b"0")), None
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        for code in ("AI_LIMIT", "ACCOUNT_SUSPENDED", "AUTH_REQUIRED"):
            if code in body:
                return None, code
        return None, "AUTH_REQUIRED" if e.code in (401, 403) else "SERVER_ERROR"
    except Exception:
        return None, "SERVER_ERROR"


STATUS = {"AUTH_REQUIRED": 401, "ACCOUNT_SUSPENDED": 403, "AI_LIMIT": 429, "INVALID_IMAGE": 400,
          "TOO_LARGE": 413, "NO_OBJECT": 422, "NOT_CONFIGURED": 503, "SERVER_ERROR": 500}


class handler(BaseHTTPRequestHandler):
    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, code):
        self._json(STATUS.get(code, 500), {"error": code})

    def do_GET(self):
        # ?verificar=1 carrega o modelo e trata uma imagem pequena de teste (diagnóstico, sem dados de ninguém).
        if "verificar" not in (parse_qs(urlparse(self.path).query) or {}):
            return self._json(200, {"ok": True})
        import time
        t = time.time()
        try:
            img = Image.new("RGB", (200, 200), (30, 120, 200))
            ImageDraw.Draw(img).ellipse((50, 50, 150, 150), fill=(240, 200, 40))
            m = object_mask(img)
            out = compose(img, m, "marca")
            return self._json(200, {"ok": True, "model": True, "found": out is not None, "seconds": round(time.time() - t, 2)})
        except Exception as e:
            return self._json(500, {"ok": False, "error": type(e).__name__})

    def do_POST(self):
        auth = self.headers.get("Authorization") or ""
        token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
        if not token:
            return self._error("AUTH_REQUIRED")
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return self._error("INVALID_IMAGE")
        if length > MAX_BYTES:
            return self._error("TOO_LARGE")
        data = self.rfile.read(length)
        as_json = (self.headers.get("Content-Type") or "").startswith("application/json")
        style = (parse_qs(urlparse(self.path).query).get("estilo") or ["branco"])[0]
        if as_json:
            try:
                payload = json.loads(data)
                data = base64.b64decode(str(payload.get("image") or ""), validate=False)
                style = str(payload.get("estilo") or style)
            except Exception:
                return self._error("INVALID_IMAGE")
            if not data:
                return self._error("INVALID_IMAGE")
        try:
            img = Image.open(io.BytesIO(data))
            if img.format not in ("JPEG", "PNG", "WEBP", "MPO"):
                return self._error("INVALID_IMAGE")
            img = ImageOps.exif_transpose(img)
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            if img.mode in ("RGBA", "LA", "P"):
                flat = Image.new("RGB", img.size, (255, 255, 255))
                rgba = img.convert("RGBA")
                flat.paste(rgba, (0, 0), rgba)
                img = flat
            else:
                img = img.convert("RGB")
        except Exception:
            return self._error("INVALID_IMAGE")

        remaining, err = _consume_quota(token)
        if err:
            return self._error(err)

        style = "marca" if style == "marca" else "branco"
        try:
            out = compose(img, object_mask(img), style)
        except Exception:
            return self._error("SERVER_ERROR")
        if out is None:
            return self._error("NO_OBJECT")
        buf = io.BytesIO()
        out.save(buf, "JPEG", quality=88, optimize=True)
        body = buf.getvalue()
        if as_json:
            return self._json(200, {"image": base64.b64encode(body).decode(), "remaining": remaining})
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Remaining", str(remaining))
        self.send_header("Access-Control-Expose-Headers", "X-Remaining")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
