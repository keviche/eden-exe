document.getElementById("close").addEventListener("click", () => {
  window.titlebarAPI.close();
});

document.getElementById("minimize").addEventListener("click", () => {
  window.titlebarAPI.minimize();
});

document.getElementById("fullscreen").addEventListener("click", () => {
  window.titlebarAPI.fullscreen();
});

window.titlebarAPI.setPlacementListener((placement) => {
  const bar = document.getElementById("titlebar");

  bar.classList.toggle("above", placement === "above");
  bar.classList.toggle("below", placement === "below");
});