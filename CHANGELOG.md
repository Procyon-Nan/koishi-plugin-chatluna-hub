# 更新日志

## 2026-09-07 version:0.7.1

- pending: 新增基于 GitHub Actions 与 npm Trusted Publisher 的自动构建发布流程，跳过已发布版本。
- pending: 将包元数据中的仓库地址与当前 Git origin 对齐，供 npm 发布来源校验使用。
- pending: 移除构建脚本对上层工作区路径的依赖，补齐独立构建依赖、对齐 ESLint 插件的 peer dependency 版本并增加 npm 锁文件。
