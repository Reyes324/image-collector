const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
const PORT = 3002;

// 确保 uploads 目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置文件存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const today = new Date().toISOString().split('T')[0];
    const todayDir = path.join(uploadsDir, today);

    if (!fs.existsSync(todayDir)) {
      fs.mkdirSync(todayDir, { recursive: true });
    }

    cb(null, todayDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只支持图片格式文件'));
    }
  }
});

// 静态文件服务
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// 上传接口
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }

  const fileInfo = {
    filename: req.file.filename,
    path: `/uploads/${path.basename(path.dirname(req.file.path))}/${req.file.filename}`,
    uploadTime: new Date().toISOString()
  };

  res.json(fileInfo);
});

// 获取所有图片列表
app.get('/images', (req, res) => {
  try {
    const images = [];

    if (fs.existsSync(uploadsDir)) {
      const dates = fs.readdirSync(uploadsDir)
        .filter(file => fs.statSync(path.join(uploadsDir, file)).isDirectory())
        .sort()
        .reverse();

      dates.forEach(date => {
        const dateDir = path.join(uploadsDir, date);
        const files = fs.readdirSync(dateDir)
          .filter(file => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file))
          .map(file => {
            const filePath = path.join(dateDir, file);
            const stats = fs.statSync(filePath);
            return {
              filename: file,
              path: `/uploads/${date}/${file}`,
              date: date,
              uploadTime: stats.mtime.toISOString()
            };
          })
          .sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));

        if (files.length > 0) {
          images.push({
            date: date,
            files: files
          });
        }
      });
    }

    res.json(images);
  } catch (error) {
    res.status(500).json({ error: '获取图片列表失败' });
  }
});

// 删除图片
app.delete('/delete/:date/:filename', (req, res) => {
  try {
    const { date, filename } = req.params;
    const filePath = path.join(uploadsDir, date, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '文件不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
});

// 获取本机 IP 地址
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// 启动服务
app.listen(PORT, () => {
  const localIP = getLocalIP();
  const localUrl = `http://localhost:${PORT}`;
  const networkUrl = `http://${localIP}:${PORT}`;

  console.log('\n🎉 图片收集站启动成功！\n');
  console.log('📱 访问地址：');
  console.log(`   本机访问: ${localUrl}`);
  console.log(`   手机访问: ${networkUrl}`);
  console.log('\n💡 使用提示：');
  console.log('   - 手机需连接同一 WiFi 网络');
  console.log('   - 图片保存在 ./uploads 文件夹');
  console.log('   - 按 Ctrl+C 停止服务\n');

  // 生成二维码
  QRCode.toString(networkUrl, { type: 'terminal', small: true }, (err, url) => {
    if (!err) {
      console.log('📱 手机扫码访问：\n');
      console.log(url);
    }
  });
});
