// DOM 元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadProgress = document.getElementById('uploadProgress');
const gallery = document.getElementById('gallery');
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalClose = document.getElementById('modalClose');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const deleteBtn = document.getElementById('deleteBtn');

let currentImageData = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadImages();
  setupEventListeners();
});

// 设置事件监听
function setupEventListeners() {
  // 点击上传按钮
  uploadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // 点击上传区域
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });

  // 文件选择
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });

  // 拖拽事件
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

  // 模态框
  modalClose.addEventListener('click', closeModal);
  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) closeModal();
  });

  // 模态框按钮
  copyBtn.addEventListener('click', copyImage);
  downloadBtn.addEventListener('click', downloadImage);
  deleteBtn.addEventListener('click', deleteImage);

  // ESC 键关闭模态框
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageModal.classList.contains('active')) {
      closeModal();
    }
  });
}

// 处理文件上传
async function handleFiles(files) {
  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

  if (imageFiles.length === 0) {
    showToast('请选择图片文件', 'error');
    return;
  }

  uploadArea.querySelector('.upload-prompt').style.display = 'none';
  uploadProgress.style.display = 'flex';

  for (const file of imageFiles) {
    try {
      await uploadFile(file);
    } catch (error) {
      console.error('上传失败:', error);
      showToast(`上传失败: ${file.name}`, 'error');
    }
  }

  uploadArea.querySelector('.upload-prompt').style.display = 'block';
  uploadProgress.style.display = 'none';
  fileInput.value = '';

  loadImages();
  showToast(`成功上传 ${imageFiles.length} 张图片`, 'success');
}

// 上传单个文件
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('上传失败');
  }

  return response.json();
}

// 加载图片列表
async function loadImages() {
  try {
    const response = await fetch('/api/images');
    const data = await response.json();

    if (data.length === 0) {
      gallery.innerHTML = '<div class="loading">还没有上传图片</div>';
      return;
    }

    renderGallery(data);
  } catch (error) {
    console.error('加载图片失败:', error);
    gallery.innerHTML = '<div class="loading">加载失败</div>';
  }
}

// 渲染图片画廊
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

    dateGroup.appendChild(dateHeader);
    dateGroup.appendChild(imageGrid);
    gallery.appendChild(dateGroup);
  });
}

// 创建图片卡片
function createImageCard(file) {
  const card = document.createElement('div');
  card.className = 'image-card';

  const img = document.createElement('img');
  img.src = file.path;
  img.alt = file.filename;
  img.loading = 'lazy';

  const info = document.createElement('div');
  info.className = 'image-info';
  info.textContent = formatTime(file.uploadTime);

  card.appendChild(img);
  card.appendChild(info);

  card.addEventListener('click', () => openModal(file));

  return card;
}

// 打开模态框
function openModal(file) {
  currentImageData = file;
  modalImage.src = file.path;
  imageModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// 关闭模态框
function closeModal() {
  imageModal.classList.remove('active');
  document.body.style.overflow = '';
  currentImageData = null;
}

// 复制图片
async function copyImage() {
  try {
    const response = await fetch(currentImageData.path);
    const blob = await response.blob();

    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ]);

    showToast('图片已复制到剪贴板', 'success');
  } catch (error) {
    console.error('复制失败:', error);
    showToast('复制失败，请手动保存', 'error');
  }
}

// 下载图片
function downloadImage() {
  const a = document.createElement('a');
  a.href = currentImageData.path;
  a.download = currentImageData.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('图片已下载', 'success');
}

// 删除图片
async function deleteImage() {
  if (!confirm('确定要删除这张图片吗？')) {
    return;
  }

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

// 显示提示消息
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// 格式化日期
function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return '📅 今天';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return '📅 昨天';
  } else {
    return `📅 ${dateString}`;
  }
}

// 格式化时间
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
