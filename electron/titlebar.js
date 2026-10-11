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

// Drag the entire EDEN.EXE window from the toolbar.
const dragSurface = document.getElementById("titlebar");

dragSurface.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || event.target.closest(".controls")) return;
  window.titlebarAPI.startDrag();
  event.preventDefault();
});

window.addEventListener("mouseup", () => {
  window.titlebarAPI.endDrag();
});

window.addEventListener("blur", () => {
  window.titlebarAPI.endDrag();
});
