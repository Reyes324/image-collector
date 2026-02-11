import { put } from '@vercel/blob';
import multiparty from 'multiparty';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  try {
    const form = new multiparty.Form();

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(400).json({ error: '解析失败' });
      }

      const file = files.image?.[0];
      if (!file) {
        return res.status(400).json({ error: '没有上传文件' });
      }

      // 检查文件类型
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
      if (!allowedTypes.includes(file.headers['content-type'])) {
        return res.status(400).json({ error: '只支持图片格式文件' });
      }

      // 生成文件名：日期_时间戳_原始名
      const today = new Date().toISOString().split('T')[0];
      const timestamp = Date.now();
      const ext = file.originalFilename.split('.').pop();
      const filename = `${today}_${timestamp}.${ext}`;

      // 读取文件内容
      const fs = require('fs');
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
    });
  } catch (error) {
    console.error('上传失败:', error);
    res.status(500).json({ error: '上传失败' });
  }
}
