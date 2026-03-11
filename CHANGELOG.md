# Changelog

本文件记录 Crafting Table 面向用户的重要版本变更。

## [v1.0.0] - 2026-03-11

首个正式版本发布，完成工作台远端存储改造，并接入 Electron Forge 打包流程。

### 新增

- 接入 Electron Forge，支持 `npm run package`、`npm run make` 和 `npm run make:dmg`
- 新增最小可运行示例后端，提供健康检查与工作台状态读写接口
- 客户端支持配置后台服务器地址
- 客户端支持接口连通性测试
- 新增应用图标及 macOS DMG 打包资源

### 变更

- 工作台业务数据改为通过 HTTP 接口从远端读取和保存
- Electron 本地 SQLite 仅用于保存客户端配置，例如 `apiBaseUrl`
- 保留今日安排、临时收集项、项目卡片管理和主题切换等核心工作台能力

### 移除

- 移除原有导入 / 导出功能
- 工作台内容不再默认保存在本地数据库

### 说明

- 当前可生成 ZIP 与 macOS DMG 安装包
- 默认按当前系统与架构打包
- 尚未配置应用签名与 notarization
