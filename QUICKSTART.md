# 快速开始指南

## ✅ 已完成配置

### 1. Python 虚拟环境
- ✅ Python 3.10.5
- ✅ 虚拟环境 `venv` 已创建
- ✅ pip 已升级到 25.3

### 2. 已安装的依赖包
- ✅ Flask 3.0.0 - Web 框架
- ✅ Requests 2.31.0 - HTTP 客户端
- ✅ NumPy 1.26.3 - 数值计算
- ✅ Pandas 2.1.4 - 数据分析
- ✅ Pydantic 2.5.3 - 数据验证
- ✅ Pytest 7.4.3 - 测试框架
- ✅ Black 23.12.1 - 代码格式化
- ✅ Flake8 7.0.0 - 代码检查
- ✅ Pylint 3.0.3 - 代码分析
- ✅ Mypy 1.8.0 - 类型检查

### 3. 项目结构
```
fitexpertknowledge/
├── venv/                    # 虚拟环境
├── src/                     # 源代码
│   ├── __init__.py
│   └── main.py             # Flask 应用示例
├── tests/                   # 测试文件
│   ├── __init__.py
│   └── test_main.py        # 测试用例
├── requirements.txt         # 依赖列表
├── .env.example            # 环境变量模板
├── .gitignore              # Git 忽略配置
├── test_env.py             # 环境测试脚本
├── Makefile                # 快捷命令
├── README_PYTHON.md        # Python 环境说明
└── QUICKSTART.md           # 本文件
```

## 🚀 立即开始

### 方式一：使用 Makefile（推荐）

```bash
# 查看所有可用命令
make help

# 检查环境
make check-env

# 运行测试
make test

# 运行 Flask 应用
make run

# 代码格式化
make format

# 代码检查
make lint
```

### 方式二：手动命令

```bash
# 1. 激活虚拟环境
source venv/bin/activate

# 2. 检查环境
python test_env.py

# 3. 运行测试
pytest tests/ -v

# 4. 运行 Flask 应用
python src/main.py

# 5. 退出虚拟环境
deactivate
```

## 📝 测试 Flask 应用

启动应用后，访问以下端点：

```bash
# 首页
curl http://localhost:5000/

# 健康检查
curl http://localhost:5000/health

# API 信息
curl http://localhost:5000/api/info
```

## 🔧 常用开发命令

```bash
# 安装新包
source venv/bin/activate
pip install package_name
pip freeze > requirements.txt

# 运行测试并查看覆盖率
make test-cov

# 代码格式化
make format

# 代码质量检查
make lint

# 类型检查
make type-check

# 清理临时文件
make clean
```

## 📋 环境变量配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
# 填入实际的配置值（API密钥、数据库URL等）
```

## ✨ 下一步

1. **阅读详细文档**: 查看 `README_PYTHON.md` 了解更多信息
2. **配置环境变量**: 编辑 `.env` 文件
3. **开发您的应用**: 在 `src/` 目录下编写代码
4. **编写测试**: 在 `tests/` 目录下添加测试用例
5. **运行质量检查**: 使用 `make lint` 和 `make format`

## 🎯 最佳实践

- 始终在虚拟环境中工作
- 提交代码前运行测试和代码检查
- 保持良好的测试覆盖率
- 遵循 PEP 8 编码规范
- 不要提交 `.env` 文件到版本控制

## 📚 相关文档

- [README_PYTHON.md](README_PYTHON.md) - Python 环境详细说明
- [Flask 官方文档](https://flask.palletsprojects.com/)
- [Pytest 文档](https://docs.pytest.org/)

---

**环境已就绪，开始开发吧！** 🎉
