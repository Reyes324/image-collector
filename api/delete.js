const { del } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: '方法不允许' });
  }

  try {
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({ error: '缺少文件名' });
    }

    // 删除 blob
    await del(filename);

    res.json({ success: true });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({ error: '删除失败: ' + error.message });
  }
};
