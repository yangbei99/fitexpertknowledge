# Python 开发环境说明

## 环境信息

- Python 版本: 3.10.5
- 虚拟环境: venv
- 包管理器: pip 25.3

## 已安装的依赖包

### Web 框架
- **Flask 3.0.0** - 轻量级 Web 框架
- **Requests 2.31.0** - HTTP 请求库

### 数据处理
- **NumPy 1.26.3** - 数值计算库
- **Pandas 2.1.4** - 数据分析库

### 工具库
- **python-dotenv 1.0.0** - 环境变量管理
- **Pydantic 2.5.3** - 数据验证

### 测试工具
- **Pytest 7.4.3** - 测试框架
- **pytest-cov 4.1.0** - 测试覆盖率

### 代码质量工具
- **Black 23.12.1** - 代码格式化
- **Flake8 7.0.0** - 代码检查
- **Pylint 3.0.3** - 代码分析
- **Mypy 1.8.0** - 类型检查

## 使用方法

### 1. 激活虚拟环境

```bash
source venv/bin/activate
```

### 2. 验证环境

```bash
python test_env.py
```

### 3. 运行 Python 脚本

```bash
python your_script.py
```

### 4. 安装额外的包

```bash
pip install package_name
```

### 5. 更新 requirements.txt

```bash
pip freeze > requirements.txt
```

### 6. 退出虚拟环境

```bash
deactivate
```

## 开发工具使用

### 代码格式化 (Black)
```bash
black .
```

### 代码检查 (Flake8)
```bash
flake8 .
```

### 代码分析 (Pylint)
```bash
pylint your_module.py
```

### 类型检查 (Mypy)
```bash
mypy your_module.py
```

### 运行测试
```bash
pytest
```

### 测试覆盖率
```bash
pytest --cov=.
```

## 项目结构建议

```
fitexpertknowledge/
├── venv/                 # 虚拟环境
├── src/                  # 源代码
│   ├── __init__.py
│   └── main.py
├── tests/                # 测试文件
│   ├── __init__.py
│   └── test_main.py
├── requirements.txt      # 依赖列表
├── .env.example         # 环境变量示例
├── .gitignore           # Git 忽略文件
└── README_PYTHON.md     # 项目说明
```

## 环境变量配置

1. 复制环境变量示例文件：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入实际配置值

## 注意事项

- 始终在虚拟环境中工作
- 定期更新依赖包
- 提交代码前运行代码质量检查工具
- 编写测试用例确保代码质量
- 不要提交 `.env` 文件到版本控制系统

## 快速开始示例

创建一个简单的 Flask 应用：

```python
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello, World!'

if __name__ == '__main__':
    app.run(debug=True)
```

保存为 `app.py`，然后运行：
```bash
python app.py
```

访问 http://127.0.0.1:5000/ 查看结果。
