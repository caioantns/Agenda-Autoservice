// --- Scanner de QR Code / Código de Barras (usa a câmera do dispositivo) ---
// Usa a biblioteca html5-qrcode, carregada dinamicamente por este arquivo a
// partir de mais de um servidor (CDN). Se o primeiro não responder (rede
// instável, CDN bloqueado, etc.), tenta o próximo automaticamente.

const _CDNS_HTML5_QRCODE = [
  "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js",
  "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
  "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js",
];

let _promessaBiblioteca = null;

function _carregarBibliotecaScanner() {
  if (typeof Html5Qrcode !== "undefined") {
    return Promise.resolve(true);
  }
  if (_promessaBiblioteca) return _promessaBiblioteca;

  _promessaBiblioteca = new Promise((resolve) => {
    let indice = 0;
    function tentarProximo() {
      if (typeof Html5Qrcode !== "undefined") {
        resolve(true);
        return;
      }
      if (indice >= _CDNS_HTML5_QRCODE.length) {
        resolve(false);
        return;
      }
      const url = _CDNS_HTML5_QRCODE[indice];
      indice++;
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => resolve(true);
      script.onerror = () => tentarProximo();
      document.head.appendChild(script);
    }
    tentarProximo();
  });

  return _promessaBiblioteca;
}

let _html5QrCode = null;
let _campoAlvoScanner = null;
let _html5QrCode = null;
let _campoAlvoScanner = null;
let _scannerAtivo = false;

async function abrirScanner(alvoDestino) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    mostrarToast("Esse navegador não permite acessar a câmera.", "erro");
    return;
  }

  // Guarda o elemento direto ou busca pelo ID
  _campoAlvoScanner = (typeof alvoDestino === "string") 
    ? document.getElementById(alvoDestino) 
    : alvoDestino;

  document.getElementById("scanner-modal").classList.remove("escondido");
  document.getElementById("scanner-status").textContent = "Carregando leitor...";

  const carregou = await _carregarBibliotecaScanner();
  if (!carregou || typeof Html5Qrcode === "undefined") {
    document.getElementById("scanner-status").textContent =
      "Não consegui carregar o leitor de código. Confira sua internet e tente de novo.";
    return;
  }

  document.getElementById("scanner-status").textContent = "Abrindo câmera...";

  _html5QrCode = new Html5Qrcode("scanner-reader");
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  _html5QrCode
    .start(
      { facingMode: "environment" },
      config,
      (textoDecodificado) => {
        document.getElementById("scanner-status").textContent = "Código lido!";
        preencherCampoScanner(textoDecodificado);
        fecharScanner();
      },
      () => {
        // Chamado a cada frame sem leitura encontrada — normal, ignora.
      }
    )
    .then(() => {
      _scannerAtivo = true;
      document.getElementById("scanner-status").textContent = "Aponte para o QR Code ou código de barras";
    })
    .catch((err) => {
      console.error(err);
      // Fallback: se der erro na câmera traseira específica, tenta abrir qualquer câmera disponível
      _html5QrCode.start(
        { facingMode: "user" },
        config,
        (textoDecodificado) => {
          document.getElementById("scanner-status").textContent = "Código lido!";
          preencherCampoScanner(textoDecodificado);
          fecharScanner();
        },
        () => {}
      ).then(() => {
        _scannerAtivo = true;
        document.getElementById("scanner-status").textContent = "Aponte para o QR Code ou código de barras";
      }).catch(() => {
        document.getElementById("scanner-status").textContent =
          "Não consegui abrir a câmera. Verifique a permissão do navegador.";
      });
    });
}

function preencherCampoScanner(texto) {
  if (!_campoAlvoScanner) return;
  
  _campoAlvoScanner.value = texto.trim();
  _campoAlvoScanner.dispatchEvent(new Event("input", { bubbles: true }));
  _campoAlvoScanner.dispatchEvent(new Event("change", { bubbles: true }));
  
  mostrarToast(`✅ Código lido: ${texto.trim()}`);
}

function fecharScanner() {
  document.getElementById("scanner-modal").classList.add("escondido");

  if (_html5QrCode && _scannerAtivo) {
    _html5QrCode
      .stop()
      .then(() => _html5QrCode.clear())
      .catch(() => {
        // Câmera já pode ter parado sozinha
      });
  }

  _html5QrCode = null;
  _scannerAtivo = false;
  _campoAlvoScanner = null;
}