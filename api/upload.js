const { put } = require('@vercel/blob');
const multiparty = require('multiparty');
const fs = require('fs');

module.exports = async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  try {
    const form = new multiparty.Form();

    return new Promise((resolve, reject) => {
      form.parse(req, async (err, fields, files) => {
        if (err) {
          res.status(400).json({ error: '解析失败' });
          return resolve();
        }

        const file = files.image?.[0];
        if (!file) {
          res.status(400).json({ error: '没有上传文件' });
          return resolve();
        }

        // 检查文件类型
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        if (!allowedTypes.includes(file.headers['content-type'])) {
          res.status(400).json({ error: '只支持图片格式文件' });
          return resolve();
        }

        try {
          // 生成文件名：日期_时间戳
          const today = new Date().toISOString().split('T')[0];
          const timestamp = Date.now();
          const ext = file.originalFilename.split('.').pop();
          const filename = `${today}_${timestamp}.${ext}`;

          // 读取文件内容
          const fileBuffer = fs.readFileSync(file.path);

          // 上传到 Vercel Blob
          const blob = await put(filename, fileBuffer, {
            access: 'public',
            contentType: file.headers['content-type'],
          });

          res.json({
            filename: filename,
            path: blob.url,
            uploadTime: new Date().toISOString(),
            date: today,
          });
          resolve();
        } catch (error) {
          console.error('上传到 Blob 失败:', error);
          res.status(500).json({ error: '上传失败: ' + error.message });
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('上传失败:', error);
    res.status(500).json({ error: '上传失败: ' + error.message });
  }
};
