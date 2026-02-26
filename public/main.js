// ========== DOM Elements ==========
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const uploadBar = document.getElementById('uploadBar');
const dropOverlay = document.getElementById('dropOverlay');
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

// Batch action elements
const batchActionBar = document.getElementById('batchActionBar');
const batchCount = document.getElementById('batchCount');
const batchCopyBtn = document.getElementById('batchCopyBtn');
const batchDeleteBtn = document.getElementById('batchDeleteBtn');
const batchCancelBtn = document.getElementById('batchCancelBtn');

let currentImageData = null;

// ========== Multi-select State ==========
const selectedCards = new Set(); // stores filenames
let isSelectionMode = false;
let lastClickedFilename = null; // for Shift+Click range selection
let allCardFiles = []; // flat ordered list of {filename, path} for range selection

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  loadImages();
  setupEventListeners();
});

// ========== Event Listeners ==========
let dragCounter = 0; // Track nested dragenter/dragleave

function setupEventListeners() {
  // Upload button click
  uploadBtn.addEventListener('click', () => fileInput.click());

  // File selection
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  // Full-page drag & drop upload (only for external file drags, not card sorting)
  function isFileDrag(e) {
    if (!e.dataTransfer) return false;
    const types = e.dataTransfer.types;
    // Standard file drag
    if (types.includes('Files')) return true;
    // Feishu/WeChat drag: image in text/html or text/uri-list (but not internal card sort which uses text/plain only)
    if (types.includes('text/html') || types.includes('text/uri-list')) {
      // Exclude internal card sort: it sets text/plain and nothing else meaningful
      if (types.length === 1 && types.includes('text/plain')) return false;
      return true;
    }
    return false;
  }

  document.addEventListener('dragenter', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      dropOverlay.classList.add('active');
    }
  });
  document.addEventListener('dragover', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  });
  document.addEventListener('dragleave', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      dropOverlay.classList.remove('active');
    }
  });
  document.addEventListener('drop', (e) => {
    if (dropOverlay.classList.contains('active')) {
      e.preventDefault();
      dragCounter = 0;
      dropOverlay.classList.remove('active');

      // Strategy 1: Standard files
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
        return;
      }

      // Strategy 2: Parse text/html for <img> tags (Feishu/WeChat)
      const html = e.dataTransfer.getData('text/html');
      if (html) {
        const urls = extractImageUrlsFromHtml(html);
        if (urls.length > 0) {
          fetchAndUploadUrls(urls);
          return;
        }
      }

      // Strategy 3: Parse text/uri-list for image URLs
      const uriList = e.dataTransfer.getData('text/uri-list');
      if (uriList) {
        const urls = uriList.split('\n')
          .map(u => u.trim())
          .filter(u => u && !u.startsWith('#') && /\.(jpe?g|png|gif|webp|bmp|svg)/i.test(u));
        if (urls.length > 0) {
          fetchAndUploadUrls(urls);
          return;
        }
      }
    }
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
      } else if (isSelectionMode) {
        clearSelection();
      }
    }
  });

  // Batch actions
  batchCopyBtn.addEventListener('click', batchCopy);
  batchDeleteBtn.addEventListener('click', batchDelete);
  batchCancelBtn.addEventListener('click', clearSelection);

  // Editor toolbar
  setupEditor();
}

// ========== Feishu/WeChat Drag Helpers ==========
function extractImageUrlsFromHtml(html) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const imgs = doc.querySelectorAll('img[src]');
    const urls = [];
    imgs.forEach(img => {
      const src = img.getAttribute('src');
      if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
        urls.push(src);
      }
    });
    return urls;
  } catch {
    return [];
  }
}

async function fetchAndUploadUrls(urls) {
  uploadBar.style.display = 'flex';
  let successCount = 0;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) continue;
      const ext = blob.type.split('/')[1] || 'png';
      const file = new File([blob], `drag_${Date.now()}.${ext}`, { type: blob.type });
      await uploadFile(file);
      successCount++;
    } catch (error) {
      console.error('外部图片获取失败:', error);
      showToast('无法获取外部图片，可能受 CORS 限制', 'error');
    }
  }

  uploadBar.style.display = 'none';
  if (successCount > 0) {
    loadImages();
    showToast(`成功上传 ${successCount} 张图片`, 'success');
  }
}

// ========== File Upload ==========
async function handleFiles(files) {
  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
  if (imageFiles.length === 0) {
    showToast('请选择图片文件', 'error');
    return;
  }

  uploadBar.style.display = 'flex';

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

  uploadBar.style.display = 'none';
  fileInput.value = '';

  if (successCount > 0) {
    clearSelection();
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
      allCardFiles = [];
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
  allCardFiles = [];

  groups.forEach(group => {
    const dateGroup = document.createElement('div');
    dateGroup.className = 'date-group';

    const dateHeader = document.createElement('div');
    dateHeader.className = 'date-header';
    dateHeader.textContent = formatDate(group.date);

    const imageGrid = document.createElement('div');
    imageGrid.className = 'image-grid';

    group.files.forEach(file => {
      allCardFiles.push(file);
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
  card.dataset.filename = file.filename;
  card.dataset.path = file.path;

  const img = document.createElement('img');
  img.src = file.path;
  img.alt = file.filename;
  img.loading = 'lazy';

  const info = document.createElement('div');
  info.className = 'image-info';
  info.textContent = formatTime(file.uploadTime);

  // Selection checkbox
  const checkbox = document.createElement('div');
  checkbox.className = 'card-select-checkbox';
  checkbox.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  // Action overlay
  const actionsOverlay = document.createElement('div');
  actionsOverlay.className = 'card-actions-overlay';

  ['edit', 'copy', 'delete'].forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'card-action-btn';
    btn.dataset.action = action;
    btn.title = action === 'edit' ? '编辑' : action === 'copy' ? '复制' : '删除';
    btn.innerHTML = getActionIcon(action);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCardAction(action, file);
    });
    actionsOverlay.appendChild(btn);
  });

  card.appendChild(img);
  card.appendChild(info);
  card.appendChild(checkbox);
  card.appendChild(actionsOverlay);

  // Prevent click from firing after drag
  let wasDragged = false;
  card.addEventListener('dragstart', () => { wasDragged = true; });
  card.addEventListener('click', (e) => {
    if (wasDragged) { wasDragged = false; return; }

    // Multi-select: Ctrl/Cmd+Click or Shift+Click
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleCardSelection(file.filename);
      return;
    }
    if (e.shiftKey && lastClickedFilename) {
      e.preventDefault();
      rangeSelect(file.filename);
      return;
    }

    // If in selection mode, toggle instead of opening modal
    if (isSelectionMode) {
      toggleCardSelection(file.filename);
      return;
    }

    openModal(file);
  });
  return card;
}

// ========== Card Action Icons & Handlers ==========
function getActionIcon(action) {
  switch (action) {
    case 'edit':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    case 'copy':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    case 'delete':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    default:
      return '';
  }
}

function handleCardAction(action, file) {
  switch (action) {
    case 'edit':
      currentImageData = file;
      openEditor();
      break;
    case 'copy':
      copyImageByPath(file.path);
      break;
    case 'delete':
      deleteImageByFilename(file.filename);
      break;
  }
}

async function copyImageByPath(path) {
  try {
    const response = await fetch(path);
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

async function deleteImageByFilename(filename) {
  if (!confirm('确定要删除这张图片吗？')) return;
  try {
    const response = await fetch(`/api/delete?filename=${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      showToast('图片已删除', 'success');
      clearSelection();
      loadImages();
    } else {
      showToast('删除失败', 'error');
    }
  } catch (error) {
    console.error('删除失败:', error);
    showToast('删除失败', 'error');
  }
}

// ========== Multi-select ==========
function toggleCardSelection(filename) {
  if (selectedCards.has(filename)) {
    selectedCards.delete(filename);
  } else {
    selectedCards.add(filename);
  }
  lastClickedFilename = filename;
  updateSelectionUI();
}

function rangeSelect(toFilename) {
  const fromIdx = allCardFiles.findIndex(f => f.filename === lastClickedFilename);
  const toIdx = allCardFiles.findIndex(f => f.filename === toFilename);
  if (fromIdx === -1 || toIdx === -1) return;

  const start = Math.min(fromIdx, toIdx);
  const end = Math.max(fromIdx, toIdx);
  for (let i = start; i <= end; i++) {
    selectedCards.add(allCardFiles[i].filename);
  }
  updateSelectionUI();
}

function clearSelection() {
  selectedCards.clear();
  isSelectionMode = false;
  lastClickedFilename = null;
  updateSelectionUI();
}

function updateSelectionUI() {
  isSelectionMode = selectedCards.size > 0;

  // Update card visual state
  document.querySelectorAll('.image-card').forEach(card => {
    const fn = card.dataset.filename;
    card.classList.toggle('selected', selectedCards.has(fn));
  });

  // Update batch action bar
  if (selectedCards.size > 0) {
    batchActionBar.style.display = 'flex';
    batchCount.textContent = `已选择 ${selectedCards.size} 张`;
  } else {
    batchActionBar.style.display = 'none';
  }
}

async function batchCopy() {
  if (selectedCards.size === 0) return;
  if (selectedCards.size > 1) {
    showToast('仅支持复制单张图片到剪贴板', 'info');
    return;
  }
  const filename = [...selectedCards][0];
  const file = allCardFiles.find(f => f.filename === filename);
  if (file) {
    await copyImageByPath(file.path);
  }
}

async function batchDelete() {
  if (selectedCards.size === 0) return;
  if (!confirm(`确定要删除选中的 ${selectedCards.size} 张图片吗？`)) return;

  let successCount = 0;
  for (const filename of selectedCards) {
    try {
      const response = await fetch(`/api/delete?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (response.ok) successCount++;
    } catch (error) {
      console.error('删除失败:', filename, error);
    }
  }

  clearSelection();
  loadImages();
  if (successCount > 0) {
    showToast(`成功删除 ${successCount} 张图片`, 'success');
  }
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
  if (!currentImageData) return;
  await copyImageByPath(currentImageData.path);
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
  if (!currentImageData) return;
  if (!confirm('确定要删除这张图片吗？')) return;
  try {
    const response = await fetch(`/api/delete?filename=${encodeURIComponent(currentImageData.filename)}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      showToast('图片已删除', 'success');
      closeModal();
      clearSelection();
      loadImages();
    } else {
      showToast('删除失败', 'error');
    }
  } catch (error) {
    console.error('删除失败:', error);
    showToast('删除失败', 'error');
  }
}

// ========== Image Editor (Object-based) ==========
const THICKNESS = [4, 8, 14];        // Arrow line widths: thin, medium, thick
const FONT_SIZES = [0.025, 0.04, 0.065]; // Relative to canvas width
const HIT_TOLERANCE = 18;            // px tolerance for clicking annotations

let editorState = {
  tool: 'arrow',
  color: '#ef4444',
  thickness: 1,       // index into THICKNESS
  fontSize: 1,        // index into FONT_SIZES
  annotations: [],    // {id, type, ...props}
  selectedId: null,
  editingAnnotationId: null, // text annotation currently being edited
  dragging: false,
  drawing: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  dragMoved: false,         // true once drag exceeds click threshold
  pendingTextEdit: null,    // annotation to edit on mouseup if no drag occurred
  startX: 0,
  startY: 0,
  baseImage: null,
  nextId: 1,
};

// Helper: measure multiline text bounding box
function getTextMetrics(text, fontSizeIdx) {
  const fs = getAbsFontSize(fontSizeIdx);
  const ctx = editorCanvas.getContext('2d');
  ctx.font = `bold ${fs}px "Plus Jakarta Sans", -apple-system, sans-serif`;
  const lines = text.split('\n');
  const lineHeight = fs * 1.2;
  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
  }
  return { width: maxWidth, height: lines.length * lineHeight, lineHeight, lines, fontSize: fs };
}

function setupEditor() {
  const thicknessGroup = document.getElementById('thicknessGroup');
  const fontSizeGroup = document.getElementById('fontSizeGroup');

  // Tool selection
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      editorState.tool = btn.dataset.tool;
      editorState.selectedId = null;
      thicknessGroup.style.display = editorState.tool === 'arrow' ? '' : 'none';
      fontSizeGroup.style.display = editorState.tool === 'text' ? '' : 'none';
      redrawCanvas();
    });
  });

  // Thickness selection
  thicknessGroup.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      thicknessGroup.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      editorState.thickness = parseInt(btn.dataset.size);
    });
  });

  // Font size selection
  fontSizeGroup.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      fontSizeGroup.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      editorState.fontSize = parseInt(btn.dataset.fontsize);
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

  editorUndo.addEventListener('click', editorUndoAction);
  editorSave.addEventListener('click', saveEditedImage);
  editorCancel.addEventListener('click', closeEditor);

  // Canvas mouse events
  editorCanvas.addEventListener('mousedown', onCanvasMouseDown);
  editorCanvas.addEventListener('mousemove', onCanvasMouseMove);
  editorCanvas.addEventListener('mouseup', onCanvasMouseUp);

  // Touch support
  editorCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    onCanvasMouseDown({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: false });
  editorCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    onCanvasMouseMove({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: false });
  editorCanvas.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    onCanvasMouseUp({ clientX: t.clientX, clientY: t.clientY });
  });

  // Text input — Enter = newline (default textarea), Escape = cancel
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      editorState.editingAnnotationId = null;
      textInputOverlay.style.display = 'none';
      redrawCanvas();
    }
  });
  textInput.addEventListener('input', autoResizeTextInput);

  // (Single click on text enters edit mode — handled in onCanvasMouseDown)
}

// --- Coordinate helpers ---
function getCanvasPos(e) {
  const rect = editorCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (editorCanvas.width / rect.width),
    y: (e.clientY - rect.top) * (editorCanvas.height / rect.height)
  };
}

function getScreenScale() {
  const rect = editorCanvas.getBoundingClientRect();
  return editorCanvas.width / rect.width;
}

// --- Hit detection ---
function hitTest(pos) {
  const tol = HIT_TOLERANCE * getScreenScale();
  // Test in reverse order (top-most first)
  for (let i = editorState.annotations.length - 1; i >= 0; i--) {
    const ann = editorState.annotations[i];
    if (ann.type === 'arrow') {
      if (distToSegment(pos, ann.fromX, ann.fromY, ann.toX, ann.toY) < tol + ann.thickness * 2) {
        return ann;
      }
    } else if (ann.type === 'text') {
      const m = getTextMetrics(ann.text, ann.fontSizeIdx);
      if (pos.x >= ann.x - 4 && pos.x <= ann.x + m.width + 4 &&
          pos.y >= ann.y - 4 && pos.y <= ann.y + m.height + 4) {
        return ann;
      }
    }
  }
  return null;
}

function distToSegment(p, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - x1, p.y - y1);
  let t = ((p.x - x1) * dx + (p.y - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy));
}

function getAbsFontSize(idx) {
  return Math.max(18, parseFloat((editorCanvas.width * FONT_SIZES[idx]).toFixed(2)));
}

// --- Canvas events ---
function onCanvasMouseDown(e) {
  const pos = getCanvasPos(e);

  // If text input is open, commit it and STOP — don't do anything else on this click.
  // User must click again to create a new text or interact with the canvas.
  if (textInputOverlay.style.display !== 'none') {
    commitText();
    return;
  }

  const hit = hitTest(pos);

  if (editorState.tool === 'text') {
    // Text tool: click on existing text → prepare for drag OR edit (decided on mouseup)
    if (hit && hit.type === 'text') {
      editorState.selectedId = hit.id;
      editorState.pendingTextEdit = hit;
      editorState.dragging = true;
      editorState.dragMoved = false;
      editorState.dragOffsetX = pos.x;
      editorState.dragOffsetY = pos.y;
      editorCanvas.style.cursor = 'move';
      redrawCanvas();
      return;
    }
    // Click on arrow annotation → select/drag
    if (hit) {
      editorState.selectedId = hit.id;
      editorState.pendingTextEdit = null;
      editorState.dragging = true;
      editorState.dragMoved = false;
      editorState.dragOffsetX = pos.x;
      editorState.dragOffsetY = pos.y;
      editorCanvas.style.cursor = 'move';
      redrawCanvas();
      return;
    }
    // Click on blank → new text input
    editorState.selectedId = null;
    showTextInput(pos.x, pos.y);
    redrawCanvas();
    return;
  }

  // Arrow tool: grab existing annotation
  if (hit) {
    editorState.selectedId = hit.id;
    editorState.dragging = true;
    editorState.dragOffsetX = pos.x;
    editorState.dragOffsetY = pos.y;
    editorCanvas.style.cursor = 'move';
    redrawCanvas();
    return;
  }

  // Arrow: start drawing
  editorState.selectedId = null;
  editorState.drawing = true;
  editorState.startX = pos.x;
  editorState.startY = pos.y;
  redrawCanvas();
}

function onCanvasMouseMove(e) {
  const pos = getCanvasPos(e);

  if (editorState.dragging) {
    const dx = pos.x - editorState.dragOffsetX;
    const dy = pos.y - editorState.dragOffsetY;

    // If pending text edit, require movement beyond threshold before committing to drag
    if (editorState.pendingTextEdit && !editorState.dragMoved) {
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        editorState.dragMoved = true;
      } else {
        return; // Don't move yet — might be a click (will open editor on mouseup)
      }
    }

    const ann = editorState.annotations.find(a => a.id === editorState.selectedId);
    if (ann) {
      if (ann.type === 'arrow') {
        ann.fromX += dx; ann.fromY += dy;
        ann.toX += dx; ann.toY += dy;
      } else if (ann.type === 'text') {
        ann.x += dx; ann.y += dy;
      }
      editorState.dragOffsetX = pos.x;
      editorState.dragOffsetY = pos.y;
      redrawCanvas();
    }
    return;
  }

  if (editorState.drawing) {
    // Arrow preview
    redrawCanvas();
    const ctx = editorCanvas.getContext('2d');
    drawArrow(ctx, editorState.startX, editorState.startY, pos.x, pos.y,
      editorState.color, THICKNESS[editorState.thickness]);
    return;
  }

  // Hover cursor
  const hit = hitTest(pos);
  editorCanvas.style.cursor = hit ? 'move' :
    (editorState.tool === 'text' ? 'text' : 'crosshair');
}

function onCanvasMouseUp(e) {
  if (editorState.dragging) {
    editorState.dragging = false;
    editorCanvas.style.cursor = editorState.tool === 'text' ? 'text' : 'crosshair';

    // If we didn't move beyond threshold, it was a click → enter edit mode
    if (editorState.pendingTextEdit && !editorState.dragMoved) {
      openTextEditMode(editorState.pendingTextEdit);
    }
    editorState.pendingTextEdit = null;
    editorState.dragMoved = false;
    return;
  }

  if (editorState.drawing) {
    editorState.drawing = false;
    const pos = getCanvasPos(e);
    const dist = Math.hypot(pos.x - editorState.startX, pos.y - editorState.startY);
    if (dist > 8) {
      editorState.annotations.push({
        id: editorState.nextId++,
        type: 'arrow',
        fromX: editorState.startX, fromY: editorState.startY,
        toX: pos.x, toY: pos.y,
        color: editorState.color,
        thickness: THICKNESS[editorState.thickness],
      });
    }
    redrawCanvas();
  }
}

// --- Drawing ---
function redrawCanvas() {
  const ctx = editorCanvas.getContext('2d');
  ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
  if (editorState.baseImage) {
    ctx.drawImage(editorState.baseImage, 0, 0);
  }
  for (const ann of editorState.annotations) {
    // Skip the annotation being edited in textarea
    if (ann.id === editorState.editingAnnotationId) continue;
    if (ann.type === 'arrow') {
      drawArrow(ctx, ann.fromX, ann.fromY, ann.toX, ann.toY, ann.color, ann.thickness);
    } else if (ann.type === 'text') {
      drawText(ctx, ann);
    }
    // Selection highlight
    if (ann.id === editorState.selectedId) {
      drawSelectionBox(ctx, ann);
    }
  }
}

function drawArrow(ctx, fromX, fromY, toX, toY, color, lineW) {
  const len = Math.hypot(toX - fromX, toY - fromY);
  const headLen = Math.max(lineW * 3, len * 0.15);
  const headWidth = headLen * 0.7;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Shorten body so it doesn't poke through the arrowhead
  const bodyEndX = toX - headLen * 0.7 * Math.cos(angle);
  const bodyEndY = toY - headLen * 0.7 * Math.sin(angle);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Body
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(bodyEndX, bodyEndY);
  ctx.stroke();

  // Arrowhead (triangle)
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 7), toY - headLen * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 7), toY - headLen * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawText(ctx, ann) {
  const m = getTextMetrics(ann.text, ann.fontSizeIdx);
  ctx.save();
  ctx.font = `bold ${m.fontSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;
  ctx.fillStyle = ann.color;
  ctx.textBaseline = 'top';
  for (let i = 0; i < m.lines.length; i++) {
    ctx.fillText(m.lines[i], ann.x, ann.y + i * m.lineHeight);
  }
  ctx.restore();
}

function drawSelectionBox(ctx, ann) {
  let x, y, w, h;
  if (ann.type === 'arrow') {
    x = Math.min(ann.fromX, ann.toX) - 6;
    y = Math.min(ann.fromY, ann.toY) - 6;
    w = Math.abs(ann.toX - ann.fromX) + 12;
    h = Math.abs(ann.toY - ann.fromY) + 12;
  } else {
    const m = getTextMetrics(ann.text, ann.fontSizeIdx);
    x = ann.x - 4; y = ann.y - 4;
    w = m.width + 8; h = m.height + 8;
  }
  ctx.save();
  ctx.strokeStyle = '#0D9488';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

// --- Text input (WYSIWYG fixed) ---
function showTextInput(canvasX, canvasY) {
  const canvasRect = editorCanvas.getBoundingClientRect();
  const screenScale = getScreenScale();
  const screenFontSize = parseFloat((getAbsFontSize(editorState.fontSize) / screenScale).toFixed(2));

  // Convert canvas coords to viewport coords (overlay is inside position:fixed editor-modal at 0,0)
  const viewportX = canvasX / screenScale + canvasRect.left;
  const viewportY = canvasY / screenScale + canvasRect.top;
  // Compensate for line-height half-leading: textarea line-height:1.2 adds 0.1*fs space above text
  const halfLeading = screenFontSize * 0.1;

  editorState.editingAnnotationId = null;

  textInputOverlay.style.display = 'block';
  // No border/padding on textarea, so position directly at text origin minus half-leading
  textInputOverlay.style.left = viewportX + 'px';
  textInputOverlay.style.top = (viewportY - halfLeading) + 'px';

  textInput.style.color = editorState.color;
  textInput.style.fontSize = screenFontSize + 'px';
  textInput.style.fontFamily = '"Plus Jakarta Sans", -apple-system, sans-serif';
  textInput.style.lineHeight = '1.2';
  textInput.value = '';
  textInput.dataset.canvasX = canvasX;
  textInput.dataset.canvasY = canvasY;

  // Initial size ~1 character
  textInput.style.width = screenFontSize + 'px';
  textInput.style.height = (screenFontSize * 1.2) + 'px';

  // Focus after layout so cursor appears immediately
  requestAnimationFrame(() => textInput.focus());
}

function openTextEditMode(ann) {
  const canvasRect = editorCanvas.getBoundingClientRect();
  const screenScale = getScreenScale();
  const screenFontSize = parseFloat((getAbsFontSize(ann.fontSizeIdx) / screenScale).toFixed(2));

  // Set editor state to match annotation
  editorState.editingAnnotationId = ann.id;
  editorState.selectedId = null;
  editorState.fontSize = ann.fontSizeIdx;
  editorState.color = ann.color;

  // Update toolbar buttons to reflect
  document.querySelectorAll('.color-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.color === ann.color);
  });
  document.getElementById('fontSizeGroup').querySelectorAll('.size-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.fontsize) === ann.fontSizeIdx);
  });

  // Ensure text tool is active
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
  document.querySelector('.tool-btn[data-tool="text"]').classList.add('active');
  editorState.tool = 'text';
  document.getElementById('thicknessGroup').style.display = 'none';
  document.getElementById('fontSizeGroup').style.display = '';

  // Convert canvas coords to viewport coords (overlay is inside position:fixed editor-modal at 0,0)
  const viewportX = ann.x / screenScale + canvasRect.left;
  const viewportY = ann.y / screenScale + canvasRect.top;
  const halfLeading = screenFontSize * 0.1;

  textInputOverlay.style.display = 'block';
  textInputOverlay.style.left = viewportX + 'px';
  textInputOverlay.style.top = (viewportY - halfLeading) + 'px';

  textInput.style.color = ann.color;
  textInput.style.fontSize = screenFontSize + 'px';
  textInput.style.fontFamily = '"Plus Jakarta Sans", -apple-system, sans-serif';
  textInput.style.lineHeight = '1.2';
  textInput.value = ann.text;
  textInput.dataset.canvasX = ann.x;
  textInput.dataset.canvasY = ann.y;

  autoResizeTextInput();
  redrawCanvas();
  // Focus after layout so cursor appears immediately
  requestAnimationFrame(() => {
    textInput.focus();
    textInput.setSelectionRange(textInput.value.length, textInput.value.length);
  });
}

function autoResizeTextInput() {
  const screenScale = getScreenScale();
  const screenFontSize = parseFloat((getAbsFontSize(editorState.fontSize) / screenScale).toFixed(2));

  // Measure longest line width
  const measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `bold ${screenFontSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;

  const lines = textInput.value.split('\n');
  let maxWidth = screenFontSize; // minimum ~1 char
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, measureCtx.measureText(line).width);
  }

  textInput.style.width = (maxWidth + screenFontSize * 0.5) + 'px';
  textInput.style.height = 'auto';
  textInput.style.height = textInput.scrollHeight + 'px';
}

function commitText() {
  const text = textInput.value.trim();
  textInputOverlay.style.display = 'none';

  if (editorState.editingAnnotationId) {
    // Editing existing annotation
    const ann = editorState.annotations.find(a => a.id === editorState.editingAnnotationId);
    if (ann) {
      if (text) {
        ann.text = text;
        ann.color = editorState.color;
        ann.fontSizeIdx = editorState.fontSize;
      } else {
        // Empty text = delete annotation
        editorState.annotations = editorState.annotations.filter(a => a.id !== editorState.editingAnnotationId);
      }
    }
    editorState.editingAnnotationId = null;
  } else {
    // New annotation
    if (!text) return;
    editorState.annotations.push({
      id: editorState.nextId++,
      type: 'text',
      x: parseFloat(textInput.dataset.canvasX),
      y: parseFloat(textInput.dataset.canvasY),
      text,
      color: editorState.color,
      fontSizeIdx: editorState.fontSize,
    });
  }
  redrawCanvas();
}

// --- Undo / Open / Close / Save ---
function editorUndoAction() {
  if (editorState.annotations.length === 0) {
    showToast('没有可撤销的操作', 'info');
    return;
  }
  editorState.annotations.pop();
  editorState.selectedId = null;
  redrawCanvas();
}

function openEditor() {
  if (!currentImageData) return;
  const imageUrl = currentImageData.path;
  closeModal();
  editorModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  editorState.annotations = [];
  editorState.selectedId = null;
  editorState.pendingTextEdit = null;
  editorState.dragMoved = false;
  editorState.nextId = 1;

  fetch(imageUrl)
    .then(res => res.blob())
    .then(blob => {
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        editorState.baseImage = img;
        editorCanvas.width = img.naturalWidth;
        editorCanvas.height = img.naturalHeight;

        const container = editorCanvasContainer;
        const maxW = container.clientWidth - 32;
        const maxH = container.clientHeight - 32;
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        editorCanvas.style.width = (img.naturalWidth * scale) + 'px';
        editorCanvas.style.height = (img.naturalHeight * scale) + 'px';

        redrawCanvas();
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
  editorState.dragging = false;
  editorState.editingAnnotationId = null;
}

async function saveEditedImage() {
  try {
    editorState.selectedId = null;
    redrawCanvas(); // remove selection box before export
    showToast('保存中...', 'info');
    const blob = await new Promise(resolve => editorCanvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], `edited_${Date.now()}.png`, { type: 'image/png' });
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('保存失败');
    closeEditor();
    clearSelection();
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
