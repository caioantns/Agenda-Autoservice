// --- Scanner de QR Code / Código de Barras ---
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
let _scannerAtivo = false;

function abrirScannerInput(btn) {
  const input = btn.parentElement ? btn.parentElement.querySelector("input") : null;
  if (input) {
    abrirScanner(input);
  } else {
    abrirScanner("f-equipamento-instalado");
  }
}

async function abrirScanner(alvoDestino) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (typeof mostrarToast === "function") {
      mostrarToast("Esse navegador não permite acessar a câmera.", "erro");
    } else {
      alert("Esse navegador não permite acessar a câmera.");
    }
    return;
  }

  _campoAlvoScanner = (typeof alvoDestino === "string")
    ? document.getElementById(alvoDestino)
    : alvoDestino;

  const modal = document.getElementById("scanner-modal");
  const status = document.getElementById("scanner-status");

  if (modal) modal.classList.remove("escondido");
  if (status) status.textContent = "Carregando leitor...";

  const carregou = await _carregarBibliotecaScanner();
  if (!carregou || typeof Html5Qrcode === "undefined") {
    if (status) status.textContent = "Não consegui carregar o leitor. Confira sua internet.";
    return;
  }

  if (status) status.textContent = "Abrindo câmera...";

  _html5QrCode = new Html5Qrcode("scanner-reader");
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  _html5QrCode
    .start(
      { facingMode: "environment" },
      config,
      (textoDecodificado) => {
        if (status) status.textContent = "Código lido!";
        preencherCampoScanner(textoDecodificado);
        fecharScanner();
      },
      () => {}
    )
    .then(() => {
      _scannerAtivo = true;
      if (status) status.textContent = "Aponte para o QR Code ou código de barras";
    })
    .catch((err) => {
      console.warn("Fallback de câmera acionado:", err);
      _html5QrCode
        .start(
          { facingMode: "user" },
          config,
          (textoDecodificado) => {
            if (status) status.textContent = "Código lido!";
            preencherCampoScanner(textoDecodificado);
            fecharScanner();
          },
          () => {}
        )
        .then(() => {
          _scannerAtivo = true;
          if (status) status.textContent = "Aponte para o QR Code ou código de barras";
        })
        .catch(() => {
          if (status) status.textContent = "Não consegui abrir a câmera. Verifique a permissão.";
        });
    });
}

function preencherCampoScanner(texto) {
  if (!_campoAlvoScanner) return;

  _campoAlvoScanner.value = texto.trim();
  _campoAlvoScanner.dispatchEvent(new Event("input", { bubbles: true }));
  _campoAlvoScanner.dispatchEvent(new Event("change", { bubbles: true }));

  if (typeof mostrarToast === "function") {
    mostrarToast(`✅ Código lido: ${texto.trim()}`);
  }
}

function fecharScanner() {
  const modal = document.getElementById("scanner-modal");
  if (modal) modal.classList.add("escondido");

  if (_html5QrCode && _scannerAtivo) {
    _html5QrCode
      .stop()
      .then(() => _html5QrCode.clear())
      .catch(() => {});
  }

  _html5QrCode = null;
  _scannerAtivo = false;
  _campoAlvoScanner = null;
}