// Adjustable item-photo preview: pick a photo, zoom and drag it inside a
// fixed frame, then read back a cropped square image ready to upload.
//
// Usage:
//   const picker = createImagePicker(document.getElementById('item-image-picker'));
//   fileInput.addEventListener('change', e => picker.load(e.target.files[0]));
//   picker.toBlob(blob => { formData.append('image', blob, 'item.jpg'); ... });
//   picker.reset(); // after a successful save, or when the modal closes

function createImagePicker(container) {
  container.innerHTML = `
    <div class="image-picker-frame">
      <canvas class="image-picker-canvas" width="220" height="220"></canvas>
      <p class="image-picker-hint">No photo selected</p>
    </div>
    <label class="image-picker-zoom-label">
      Zoom
      <input type="range" class="image-picker-zoom" min="100" max="300" value="100" disabled>
    </label>
  `;

  const canvas = container.querySelector('.image-picker-canvas');
  const ctx = canvas.getContext('2d');
  const zoomSlider = container.querySelector('.image-picker-zoom');
  const hint = container.querySelector('.image-picker-hint');
  const SIZE = canvas.width;

  let img = null;
  let baseScale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let dragStart = null;

  function currentScale() {
    return baseScale * (Number(zoomSlider.value) / 100);
  }

  function draw() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (!img) return;
    const scale = currentScale();
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (SIZE - w) / 2 + offsetX;
    const y = (SIZE - h) / 2 + offsetY;
    ctx.drawImage(img, x, y, w, h);
  }

  function clampOffsets() {
    const scale = currentScale();
    const w = img.width * scale;
    const h = img.height * scale;
    const maxX = Math.max(0, (w - SIZE) / 2);
    const maxY = Math.max(0, (h - SIZE) / 2);
    offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
    offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
  }

  function load(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const image = new Image();
      image.onload = () => {
        img = image;
        baseScale = Math.max(SIZE / img.width, SIZE / img.height);
        offsetX = 0;
        offsetY = 0;
        zoomSlider.value = 100;
        zoomSlider.disabled = false;
        hint.style.display = 'none';
        draw();
      };
      image.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function startDrag(x, y) {
    if (!img) return;
    dragging = true;
    dragStart = { x: x - offsetX, y: y - offsetY };
  }
  function moveDrag(x, y) {
    if (!dragging) return;
    offsetX = x - dragStart.x;
    offsetY = y - dragStart.y;
    clampOffsets();
    draw();
  }
  function endDrag() { dragging = false; }

  zoomSlider.addEventListener('input', () => { clampOffsets(); draw(); });

  canvas.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);

  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, { passive: true });
  canvas.addEventListener('touchend', endDrag);

  function toBlob(callback, type, quality) {
    if (!img) return callback(null);
    canvas.toBlob(callback, type || 'image/jpeg', quality || 0.9);
  }

  function reset() {
    img = null;
    offsetX = 0;
    offsetY = 0;
    zoomSlider.value = 100;
    zoomSlider.disabled = true;
    hint.style.display = '';
    ctx.clearRect(0, 0, SIZE, SIZE);
  }

  function hasImage() {
    return !!img;
  }

  return { load, toBlob, reset, hasImage };
}
