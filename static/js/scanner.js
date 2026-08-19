// --- Scanner de QR Code / Código de Barras (usa a câmera do dispositivo) ---
// Requer a biblioteca html5-qrcode (carregada via CDN antes deste arquivo,
// expõe a classe global "Html5Qrcode"). Por padrão ela já escaneia QR Code
// e todos os formatos de código de barras (EAN, CODE_128, UPC, etc.) juntos,
// sem precisar restringir formato nenhum.

let _html5QrCode = null;
let _campoAlvoScanner = null;
let _scannerAtivo = false;

function abrirScanner(idCampoDestino) {
  if (typeof Html5Qrcode === "undefined") {
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
        // chamado a cada frame sem leitura encontrada — normal, ignora.
      }
    )
    .then(() => {
      _scannerAtivo = true;
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

  if (_html5QrCode && _scannerAtivo) {
    _html5QrCode
      .stop()
      .then(() => _html5QrCode.clear())
      .catch(() => {
        // câmera já pode ter parado sozinha — sem problema
      });
  }

  _html5QrCode = null;
  _scannerAtivo = false;
  _campoAlvoScanner = null;
}
