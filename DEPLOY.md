# 部署指南

## 准备工作

### 1. 注册 Vercel 账号
访问 [vercel.com](https://vercel.com) 并注册账号（可以用 GitHub 登录）

### 2. 安装 Vercel CLI
```bash
npm install -g vercel
```

### 3. 登录 Vercel
```bash
vercel login
```

按提示完成登录（会打开浏览器）

## 部署步骤

### 方式一：命令行部署（推荐）

1. **进入项目目录**
```bash
cd ~/image-collector
```

2. **首次部署**
```bash
vercel
```

按照提示操作：
- `Set up and deploy?` → 回车（Yes）
- `Which scope?` → 选择你的账号
- `Link to existing project?` → N（首次部署选 No）
- `What's your project's name?` → 回车（使用默认名 image-collector）
- `In which directory is your code located?` → 回车（当前目录）
- 检测到设置后，全部回车确认

3. **等待部署完成**
几分钟后会显示：
```
✅ Production: https://image-collector-xxx.vercel.app
```

4. **配置环境变量（首次部署后）**

前往 Vercel Dashboard：
- 打开 https://vercel.com/dashboard
- 进入你的项目 `image-collector`
- 点击 Settings → Environment Variables
- 添加变量（Vercel Blob 会自动配置，无需手动添加）

5. **后续更新**
修改代码后，再次运行：
```bash
vercel --prod
```

### 方式二：GitHub 自动部署

1. **创建 GitHub 仓库**
```bash
cd ~/image-collector
git init
git add .
git commit -m "Initial commit"
gh repo create image-collector --public --source=. --push
```

2. **在 Vercel 导入项目**
- 访问 https://vercel.com/new
- 点击 "Import Git Repository"
- 选择你的 GitHub 仓库
- 点击 Deploy

3. **自动部署**
以后每次推送代码到 GitHub，Vercel 会自动部署。

## 访问你的应用

部署成功后，你会获得一个网址，例如：
```
https://image-collector-xxx.vercel.app
```

- 电脑访问这个网址
- 手机访问这个网址
- 随时随地，无需同一WiFi！

## 自定义域名（可选）

1. 在 Vercel Dashboard → Domains
2. 添加你的域名
3. 按照提示配置 DNS

## 故障排查

### 部署失败？
```bash
# 查看详细日志
vercel logs
```

### 上传失败？
- 检查 Vercel Blob 是否已启用
- 前往 Storage → Blob，确认已创建

### 图片显示不出来？
- 检查浏览器控制台错误
- 确认 CORS 设置正确

## 成本

- **免费额度**：
  - Blob Storage: 1GB 存储
  - 100GB 带宽/月
  - 适合个人使用

- **超出后**：按量计费，非常便宜

## 监控

访问 https://vercel.com/dashboard 查看：
- 访问量
- 存储使用情况
- 部署历史
