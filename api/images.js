const { list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '方法不允许' });
  }

  try {
    // 获取所有 blob 文件
    const { blobs } = await list();

    // 按日期分组
    const groupedImages = {};

    blobs.forEach(blob => {
      // 从文件名提取日期：YYYY-MM-DD_timestamp.ext
      const match = blob.pathname.match(/^(\d{4}-\d{2}-\d{2})_/);
      if (match) {
        const date = match[1];

        if (!groupedImages[date]) {
          groupedImages[date] = [];
        }

        groupedImages[date].push({
          filename: blob.pathname,
          path: blob.url,
          date: date,
          uploadTime: blob.uploadedAt,
        });
      }
    });

    // 转换为数组并排序
    const result = Object.keys(groupedImages)
      .sort()
      .reverse()
      .map(date => ({
        date: date,
        files: groupedImages[date].sort((a, b) =>
          new Date(b.uploadTime) - new Date(a.uploadTime)
        ),
      }));

    res.json(result);
  } catch (error) {
    console.error('获取图片列表失败:', error);
    res.status(500).json({ error: '获取图片列表失败: ' + error.message });
  }
};
