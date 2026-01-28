# Makefile for FitExpertKnowledge Python Project

.PHONY: help install test run clean lint format type-check

help:  ## 显示帮助信息
	@echo "可用命令:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install:  ## 安装依赖
	python3 -m venv venv
	. venv/bin/activate && pip install --upgrade pip
	. venv/bin/activate && pip install -r requirements.txt

test:  ## 运行测试
	. venv/bin/activate && pytest tests/ -v

test-cov:  ## 运行测试并生成覆盖率报告
	. venv/bin/activate && pytest tests/ --cov=src --cov-report=html --cov-report=term

run:  ## 运行 Flask 应用
	. venv/bin/activate && python src/main.py

lint:  ## 运行代码检查
	. venv/bin/activate && flake8 src tests
	. venv/bin/activate && pylint src tests

format:  ## 格式化代码
	. venv/bin/activate && black src tests

type-check:  ## 类型检查
	. venv/bin/activate && mypy src

check-env:  ## 检查环境配置
	. venv/bin/activate && python test_env.py

clean:  ## 清理临时文件
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name ".coverage" -delete

setup:  ## 初始化项目（首次使用）
	cp .env.example .env
	@echo "请编辑 .env 文件配置环境变量"
