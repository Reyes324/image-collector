// ========== DOM Elements ==========
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const gallery = document.getElementById('gallery');
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalClose = document.getElementById('modalClose');
const editBtn = document.getElementById('editBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const deleteBtn = document.getElementById('deleteBtn');

// Editor elements
const editorModal = document.getElementById('editorModal');
const editorCanvas = document.getElementById('editorCanvas');
const editorCanvasContainer = document.getElementById('editorCanvasContainer');
const editorUndo = document.getElementById('editorUndo');
const editorSave = document.getElementById('editorSave');
const editorCancel = document.getElementById('editorCancel');
const textInputOverlay = document.getElementById('textInputOverlay');
const textInput = document.getElementById('textInput');

let currentImageData = null;

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  loadImages();
  setupEventListeners();
});

// ========== Event Listeners ==========
function setupEventListeners() {
  // Upload area click + keyboard
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // File selection
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  // Drag & drop upload
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  // Paste upload (Ctrl+V)
  document.addEventListener('paste', (e) => {
    if (editorModal.classList.contains('active')) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFiles(imageFiles);
    }
  });

  // Modal
  modalClose.addEventListener('click', closeModal);
  imageModal.querySelector('.modal-overlay').addEventListener('click', closeModal);
  editBtn.addEventListener('click', openEditor);
  copyBtn.addEventListener('click', copyImage);
  downloadBtn.addEventListener('click', downloadImage);
  deleteBtn.addEventListener('click', deleteImage);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (editorModal.classList.contains('active')) {
        closeEditor();
      } else if (imageModal.classList.contains('active')) {
        closeModal();
      }
    }
  });

  // Editor toolbar
  setupEditor();
}

// ========== File Upload ==========
async function handleFiles(files) {
  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
  if (imageFiles.length === 0) {
    showToast('请选择图片文件', 'error');
    return;
  }

  uploadArea.querySelector('.upload-prompt').style.display = 'none';
  uploadProgress.style.display = 'flex';

  let successCount = 0;
  for (const file of imageFiles) {
    try {
      await uploadFile(file);
      successCount++;
    } catch (error) {
      console.error('上传失败:', error);
      showToast(`上传失败: ${file.name}`, 'error');
    }
  }

  uploadArea.querySelector('.upload-prompt').style.display = 'block';
  uploadProgress.style.display = 'none';
  fileInput.value = '';

  if (successCount > 0) {
    loadImages();
    showToast(`成功上传 ${successCount} 张图片`, 'success');
  }
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!response.ok) throw new Error('上传失败');
  return response.json();
}

// ========== Gallery ==========
async function loadImages() {
  try {
    const response = await fetch('/api/images');
    const data = await response.json();
    if (data.length === 0) {
      gallery.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <p>还没有图片，上传第一张吧</p>
        </div>`;
      return;
    }
    renderGallery(data);
  } catch (error) {
    console.error('加载图片失败:', error);
    gallery.innerHTML = '<div class="empty-state"><p>加载失败，请刷新重试</p></div>';
  }
}

function renderGallery(groups) {
  gallery.innerHTML = '';
  groups.forEach(group => {
    const dateGroup = document.createElement('div');
    dateGroup.className = 'date-group';

    const dateHeader = document.createElement('div');
    dateHeader.className = 'date-header';
    dateHeader.textContent = formatDate(group.date);

    const imageGrid = document.createElement('div');
    imageGrid.className = 'image-grid';

    group.files.forEach(file => {
      const card = createImageCard(file);
      imageGrid.appendChild(card);
    });

    setupDragSort(imageGrid);

    dateGroup.appendChild(dateHeader);
    dateGroup.appendChild(imageGrid);
    gallery.appendChild(dateGroup);
  });
}

function createImageCard(file) {
  const card = document.createElement('div');
  card.className = 'image-card';
  card.draggable = true;

  const img = document.createElement('img');
  img.src = file.path;
  img.alt = file.filename;
  img.loading = 'lazy';

  const info = document.createElement('div');
  info.className = 'image-info';
  info.textContent = formatTime(file.uploadTime);

  card.appendChild(img);
  card.appendChild(info);

  // Prevent click from firing after drag
  let wasDragged = false;
  card.addEventListener('dragstart', () => { wasDragged = true; });
  card.addEventListener('click', () => {
    if (wasDragged) { wasDragged = false; return; }
    openModal(file);
  });
  return card;
}

// ========== Drag & Drop Sorting ==========
function setupDragSort(grid) {
  let draggedCard = null;

  grid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.image-card');
    if (!card) return;
    draggedCard = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Needed for Firefox
    e.dataTransfer.setData('text/plain', '');
  });

  grid.addEventListener('dragend', (e) => {
    const card = e.target.closest('.image-card');
    if (card) card.classList.remove('dragging');
    grid.querySelectorAll('.image-card').forEach(c => {
      c.classList.remove('drag-target-before', 'drag-target-after');
    });
    draggedCard = null;
  });

  grid.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.image-card');
    if (!target || target === draggedCard) return;

    grid.querySelectorAll('.image-card').forEach(c => {
      c.classList.remove('drag-target-before', 'drag-target-after');
    });

    const rect = target.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    if (e.clientX < midX) {
      target.classList.add('drag-target-before');
    } else {
      target.classList.add('drag-target-after');
    }
  });

  grid.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('.image-card');
    if (!target || !draggedCard || target === draggedCard) return;

    const rect = target.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    if (e.clientX < midX) {
      grid.insertBefore(draggedCard, target);
    } else {
      grid.insertBefore(draggedCard, target.nextSibling);
    }

    grid.querySelectorAll('.image-card').forEach(c => {
      c.classList.remove('drag-target-before', 'drag-target-after');
    });
  });
}

// ========== Modal ==========
function openModal(file) {
  currentImageData = file;
  modalImage.src = file.path;
  imageModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  imageModal.classList.remove('active');
  document.body.style.overflow = '';
  currentImageData = null;
}

async function copyImage() {
  try {
    // Clipboard API only supports image/png — convert all formats via canvas
    const response = await fetch(currentImageData.path);
    const blob = await response.blob();
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    const pngBlob = await new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('转换 PNG 失败'));
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('加载图片失败'));
      };
      img.src = objectUrl;
    });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    showToast('图片已复制到剪贴板', 'success');
  } catch (error) {
    console.error('复制失败:', error);
    showToast('复制失败', 'error');
  }
}

function downloadImage() {
  const a = document.createElement('a');
  a.href = currentImageData.path;
  a.download = currentImageData.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('图片已下载', 'success');
}

async function deleteImage() {
  if (!confirm('确定要删除这张图片吗？')) return;
  try {
    const response = await fetch(`/api/delete?filename=${encodeURIComponent(currentImageData.filename)}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      showToast('图片已删除', 'success');
      closeModal();
      loadImages();
    } else {
      showToast('删除失败', 'error');
    }
  } catch (error) {
    console.error('删除失败:', error);
    showToast('删除失败', 'error');
  }
}

// ========== Image Editor ==========
let editorState = {
  tool: 'arrow',     // 'arrow' | 'text'
  color: '#ef4444',
  drawing: false,
  startX: 0,
  startY: 0,
  history: [],       // Array of ImageData snapshots
  baseImage: null,   // Original HTMLImageElement
};

function setupEditor() {
  // Tool selection
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      editorState.tool = btn.dataset.tool;
      editorCanvas.style.cursor = editorState.tool === 'text' ? 'text' : 'crosshair';
    });
  });

  // Color selection
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      editorState.color = btn.dataset.color;
    });
  });

  // Undo
  editorUndo.addEventListener('click', editorUndoAction);

  // Save
  editorSave.addEventListener('click', saveEditedImage);

  // Cancel
  editorCancel.addEventListener('click', closeEditor);

  // Canvas events
  editorCanvas.addEventListener('mousedown', onCanvasMouseDown);
  editorCanvas.addEventListener('mousemove', onCanvasMouseMove);
  editorCanvas.addEventListener('mouseup', onCanvasMouseUp);

  // Touch support
  editorCanvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
  editorCanvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
  editorCanvas.addEventListener('touchend', onCanvasTouchEnd);

  // Text input
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      commitText();
    } else if (e.key === 'Escape') {
      textInputOverlay.style.display = 'none';
    }
  });
}

function getCanvasPos(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const scaleX = editorCanvas.width / rect.width;
  const scaleY = editorCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function onCanvasMouseDown(e) {
  const pos = getCanvasPos(e);
  if (editorState.tool === 'text') {
    showTextInput(e.clientX, e.clientY, pos.x, pos.y);
    return;
  }
  // Arrow tool
  editorState.drawing = true;
  editorState.startX = pos.x;
  editorState.startY = pos.y;
  // Save current state for preview restoration
  const ctx = editorCanvas.getContext('2d');
  editorState.previewSnapshot = ctx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);
}

function onCanvasMouseMove(e) {
  if (!editorState.drawing) return;
  const ctx = editorCanvas.getContext('2d');
  const pos = getCanvasPos(e);
  // Restore before drawing preview
  ctx.putImageData(editorState.previewSnapshot, 0, 0);
  drawArrow(ctx, editorState.startX, editorState.startY, pos.x, pos.y, editorState.color);
}

function onCanvasMouseUp(e) {
  if (!editorState.drawing) return;
  editorState.drawing = false;
  const ctx = editorCanvas.getContext('2d');
  const pos = getCanvasPos(e);
  // Restore clean state
  ctx.putImageData(editorState.previewSnapshot, 0, 0);
  // Save history before drawing
  pushHistory();
  drawArrow(ctx, editorState.startX, editorState.startY, pos.x, pos.y, editorState.color);
}

// Touch support
function onCanvasTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  onCanvasMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
}

function onCanvasTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  onCanvasMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
}

function onCanvasTouchEnd(e) {
  const touch = e.changedTouches[0];
  onCanvasMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
}

function drawArrow(ctx, fromX, fromY, toX, toY, color) {
  const headLen = Math.max(16, Math.hypot(toX - fromX, toY - fromY) * 0.08);
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Line
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function showTextInput(screenX, screenY, canvasX, canvasY) {
  const containerRect = editorCanvasContainer.getBoundingClientRect();
  textInputOverlay.style.display = 'block';
  textInputOverlay.style.left = (screenX - containerRect.left) + 'px';
  textInputOverlay.style.top = (screenY - containerRect.top) + 'px';
  textInput.value = '';
  textInput.dataset.canvasX = canvasX;
  textInput.dataset.canvasY = canvasY;
  textInput.focus();
}

function commitText() {
  const text = textInput.value.trim();
  if (!text) {
    textInputOverlay.style.display = 'none';
    return;
  }
  const cx = parseFloat(textInput.dataset.canvasX);
  const cy = parseFloat(textInput.dataset.canvasY);
  const ctx = editorCanvas.getContext('2d');

  pushHistory();

  const fontSize = Math.max(20, Math.round(editorCanvas.width / 40));
  ctx.save();
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = editorState.color;
  ctx.textBaseline = 'top';

  // Text shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillText(text, cx, cy);
  ctx.restore();

  textInputOverlay.style.display = 'none';
}

function pushHistory() {
  const ctx = editorCanvas.getContext('2d');
  editorState.history.push(ctx.getImageData(0, 0, editorCanvas.width, editorCanvas.height));
  // Limit history to 30 steps
  if (editorState.history.length > 30) editorState.history.shift();
}

function editorUndoAction() {
  if (editorState.history.length === 0) {
    showToast('没有可撤销的操作', 'info');
    return;
  }
  const ctx = editorCanvas.getContext('2d');
  const prev = editorState.history.pop();
  ctx.putImageData(prev, 0, 0);
}

function openEditor() {
  if (!currentImageData) return;
  const imageUrl = currentImageData.path;
  closeModal();
  editorModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  editorState.history = [];

  // Fetch image as blob to avoid CORS canvas tainting
  fetch(imageUrl)
    .then(res => res.blob())
    .then(blob => {
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        editorState.baseImage = img;
        const canvas = editorCanvas;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Fit canvas in container
        const container = editorCanvasContainer;
        const maxW = container.clientWidth - 32;
        const maxH = container.clientHeight - 32;
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        canvas.style.width = (img.naturalWidth * scale) + 'px';
        canvas.style.height = (img.naturalHeight * scale) + 'px';
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    })
    .catch(() => {
      showToast('加载图片失败', 'error');
      closeEditor();
    });
}

function closeEditor() {
  editorModal.classList.remove('active');
  document.body.style.overflow = '';
  textInputOverlay.style.display = 'none';
  editorState.drawing = false;
}

async function saveEditedImage() {
  try {
    showToast('保存中...', 'info');
    const blob = await new Promise(resolve => {
      editorCanvas.toBlob(resolve, 'image/png');
    });
    const file = new File([blob], `edited_${Date.now()}.png`, { type: 'image/png' });
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('保存失败');
    closeEditor();
    loadImages();
    showToast('编辑后的图片已保存', 'success');
  } catch (error) {
    console.error('保存失败:', error);
    showToast('保存失败', 'error');
  }
}

// ========== Utilities ==========
function showToast(message, type = 'info') {
  // Remove existing toasts
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return '今天';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return '昨天';
  } else {
    return dateString;
  }
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
