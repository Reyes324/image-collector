# 📸 图片收集站 - 云端版

已升级为云端版本！现在可以随时随地访问，不受网络限制。

## ✨ 云端版优势

- 🌍 **随时随地访问**：不限网络，公司WiFi也能用
- 📱 **多设备同步**：手机上传，电脑立即可见
- ⚡ **更快速度**：CDN加速，全球访问飞快
- 💾 **永久存储**：数据存在云端，安全可靠
- 🆓 **完全免费**：Vercel 免费额度足够个人使用

## 🚀 快速部署（3步搞定）

### 第一步：安装 Vercel CLI

```bash
npm install -g vercel
```

### 第二步：登录 Vercel

```bash
vercel login
```

会打开浏览器，用 GitHub/GitLab/Email 登录即可（推荐用 GitHub）

### 第三步：部署

```bash
cd ~/image-collector
vercel
```

按照提示操作（全部回车使用默认值即可）

### 完成！

部署完成后会显示网址，例如：
```
✅ Production: https://image-collector-abc123.vercel.app
```

复制这个网址，手机电脑都可以访问！

## 📱 使用方式

### 手机上传
1. 手机浏览器打开部署后的网址
2. 点击上传区域
3. 选择照片或拍照
4. 立即上传到云端

### 电脑查看
1. 浏览器打开同一个网址
2. 查看所有图片（自动同步）
3. 点击复制，粘贴到文档

## 🔄 更新代码

修改代码后，重新部署：

```bash
vercel --prod
```

或使用快捷命令：

```bash
npm run deploy
```

## 💰 费用说明

**Vercel 免费额度：**
- ✅ 100GB 流量/月
- ✅ 1GB Blob 存储
- ✅ 无限次部署
- ✅ 自动 HTTPS
- ✅ 全球 CDN

**够用吗？**
- 1GB 存储 ≈ 2000-5000 张截图
- 100GB 流量 ≈ 每天上传/查看 100 张图片

对于个人使用完全够用！

## 📊 监控面板

访问 [Vercel Dashboard](https://vercel.com/dashboard) 查看：
- 存储使用情况
- 访问统计
- 部署历史

## 🔧 本地开发（可选）

如果要本地测试云端功能：

```bash
npm run dev
```

会在本地启动一个模拟云端环境的服务器。

## ❓ 常见问题

**Q: 需要付费吗？**
A: 不需要！免费额度足够个人使用。

**Q: 数据安全吗？**
A: 存储在 Vercel Blob，与你的 Vercel 账号绑定，只有你能访问。

**Q: 可以自定义域名吗？**
A: 可以！在 Vercel Dashboard → Settings → Domains 添加。

**Q: 如何删除云端数据？**
A: Vercel Dashboard → Storage → Blob，可以查看和删除所有文件。

**Q: 首次部署需要配置什么吗？**
A: 不需要！Vercel 会自动识别并配置 Blob 存储。

## 📖 详细部署指南

查看 [DEPLOY.md](./DEPLOY.md) 获取更详细的部署说明和故障排查。
