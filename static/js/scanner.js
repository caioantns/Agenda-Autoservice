// --- Scanner de QR Code / Código de Barras (usa a câmera do dispositivo) ---
// Requer a biblioteca @zxing/browser (carregada via CDN antes deste arquivo,
// expõe o objeto global "ZXingBrowser").

let _leitorZXing = null;
let _controlesScanner = null;
let _campoAlvoScanner = null;

function abrirScanner(idCampoDestino) {
  if (typeof ZXingBrowser === "undefined") {
    mostrarToast("Leitor de código não carregou. Confira sua internet e recarregue a página.", "erro");
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    mostrarToast("Esse navegador não permite acessar a câmera.", "erro");
    return;
  }

  _campoAlvoScanner = idCampoDestino;
  document.getElementById("scanner-modal").classList.remove("escondido");
  document.getElementById("scanner-status").textContent = "Abrindo câmera...";

  _leitorZXing = new ZXingBrowser.BrowserMultiFormatReader();

  _leitorZXing
    .decodeFromConstraints(
      { video: { facingMode: { ideal: "environment" } } },
      "scanner-video",
      (resultado, erro, controls) => {
        _controlesScanner = controls;
        if (resultado) {
          const texto = resultado.getText();
          document.getElementById("scanner-status").textContent = "Código lido!";
          preencherCampoScanner(texto);
          fecharScanner();
        }
        // erro (NotFoundException) é disparado a cada frame sem leitura — normal, ignora.
      }
    )
    .then((controls) => {
      _controlesScanner = controls;
      document.getElementById("scanner-status").textContent = "Aponte para o QR Code ou código de barras";
    })
    .catch((err) => {
      console.error(err);
      document.getElementById("scanner-status").textContent =
        "Não consegui abrir a câmera. Verifique a permissão do navegador.";
    });
}

function preencherCampoScanner(texto) {
  if (!_campoAlvoScanner) return;
  const campo = document.getElementById(_campoAlvoScanner);
  if (campo) {
    campo.value = texto.trim();
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  }
  mostrarToast(`✅ Código lido: ${texto.trim()}`);
}

function fecharScanner() {
  document.getElementById("scanner-modal").classList.add("escondido");
  if (_controlesScanner) {
    try {
      _controlesScanner.stop();
    } catch (e) {
      // silencioso — só estamos garantindo que a câmera desligue
    }
  }
  _leitorZXing = null;
  _controlesScanner = null;
  _campoAlvoScanner = null;
}
