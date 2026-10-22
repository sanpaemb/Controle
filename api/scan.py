import json
import os
import re
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler

PROMPT = """Leia cuidadosamente a foto do formulário CONTROLE DIÁRIO DE CORTE E SOLDA.
Responda somente JSON válido com formato:
{"date":"YYYY-MM-DD","operator":"nome","size":"medida","rows":[{"bobbin":1,"product":"material e cor","start":"HH:MM","end":"HH:MM","qty":1000,"stops":0,"notes":"paradas e dúvidas","uncertain":false}],"warnings":[]}.
Inclua todas as bobinas que apresentem informações; não invente números. Campos ilegíveis: quantidade null, horários string vazia, paradas null. Não transforme intervalos entre bobinas em paradas. Não deduza quantidade pelo total do dia. Marque uncertain=true nos campos duvidosos e explique em notes. Identifique data, operador, produto, medida, paradas e motivo da parada quando visíveis. Preserve as quantidades manuscritas mesmo que pareçam incomuns. Se a data estiver no formato DD/MM/AAAA, converta para YYYY-MM-DD."""

class handler(BaseHTTPRequestHandler):
    def respond(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        self.respond(200, {"service": "sanpa-python-scan", "configured": bool(os.environ.get("OPENAI_API_KEY") and os.environ.get("CAPTURE_PIN"))})

    def do_POST(self):
        pin = os.environ.get("CAPTURE_PIN")
        key = os.environ.get("OPENAI_API_KEY")
        if not pin or not key:
            return self.respond(503, {"error": "Configure OPENAI_API_KEY e CAPTURE_PIN nas variáveis Production da Vercel."})
        if self.headers.get("x-capture-pin", "") != pin:
            return self.respond(401, {"error": "Código de acesso inválido."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 12500000:
                return self.respond(413, {"error": "Imagem muito grande."})
            body = json.loads(self.rfile.read(length))
            image = body.get("image", "")
            if not isinstance(image, str) or not re.match(r"^data:image/(jpeg|png|webp);base64,", image):
                return self.respond(400, {"error": "Envie uma imagem JPEG, PNG ou WebP."})
            context = "Contexto da ficha: data=%s, operador=%s, tamanho=%s. Use como contexto somente se ilegível na foto." % (
                str(body.get("date", ""))[:30], str(body.get("operator", ""))[:80], str(body.get("size", ""))[:40])
            payload = {"model": os.environ.get("OPENAI_VISION_MODEL", "gpt-4.1-mini"),
                "instructions": PROMPT,
                "input": [{"role": "user", "content": [{"type": "input_text", "text": context}, {"type": "input_image", "image_url": image}]}],
                "max_output_tokens": 3500}
            req = urllib.request.Request("https://api.openai.com/v1/responses",
                data=json.dumps(payload).encode(), headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"}, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=50) as response:
                    result = json.loads(response.read())
            except urllib.error.HTTPError as err:
                return self.respond(502, {"error": "Serviço de IA recusou a solicitação (HTTP %s). Verifique a chave, saldo e permissões da API." % err.code})
            txt = "".join(p.get("text", "") for item in result.get("output", []) for p in item.get("content", []) if p.get("type") == "output_text")
            txt = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", txt.strip(), flags=re.I)
            obj = json.loads(txt)
            if not isinstance(obj.get("rows"), list):
                return self.respond(502, {"error": "Resposta da IA não contém bobinas."})
            rows = []
            for r in obj["rows"][:100]:
                rows.append({"bobbin": r.get("bobbin"), "product": str(r.get("product") or "")[:150],
                    "start": r.get("start") if re.fullmatch(r"\d\d:\d\d", str(r.get("start") or "")) else "",
                    "end": r.get("end") if re.fullmatch(r"\d\d:\d\d", str(r.get("end") or "")) else "",
                    "qty": r.get("qty") if isinstance(r.get("qty"), (int, float)) and r.get("qty") >= 0 else None,
                    "stops": r.get("stops") if isinstance(r.get("stops"), (int, float)) and r.get("stops") >= 0 else None,
                    "notes": str(r.get("notes") or "")[:250], "uncertain": bool(r.get("uncertain"))})
            return self.respond(200, {"date": obj.get("date") or body.get("date") or "",
                "operator": obj.get("operator") or body.get("operator") or "",
                "size": obj.get("size") or body.get("size") or "",
                "rows": rows, "warnings": obj.get("warnings") if isinstance(obj.get("warnings"), list) else []})
        except Exception:
            return self.respond(500, {"error": "Falha na interpretação. Confira a imagem e tente novamente."})
