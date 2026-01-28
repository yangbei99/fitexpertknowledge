#!/usr/bin/env python3
"""
测试Python环境配置
运行此脚本以验证所有依赖包是否正确安装
"""

def test_imports():
    """测试基础包导入"""
    print("🔍 测试依赖包导入...\n")
    
    try:
        import flask
        print("✅ Flask:", flask.__version__)
    except ImportError as e:
        print("❌ Flask 导入失败:", e)
    
    try:
        import requests
        print("✅ Requests:", requests.__version__)
    except ImportError as e:
        print("❌ Requests 导入失败:", e)
    
    try:
        import numpy as np
        print("✅ NumPy:", np.__version__)
    except ImportError as e:
        print("❌ NumPy 导入失败:", e)
    
    try:
        import pandas as pd
        print("✅ Pandas:", pd.__version__)
    except ImportError as e:
        print("❌ Pandas 导入失败:", e)
    
    try:
        import pydantic
        print("✅ Pydantic:", pydantic.__version__)
    except ImportError as e:
        print("❌ Pydantic 导入失败:", e)
    
    try:
        import pytest
        print("✅ Pytest:", pytest.__version__)
    except ImportError as e:
        print("❌ Pytest 导入失败:", e)
    
    try:
        import black
        print("✅ Black:", black.__version__)
    except ImportError as e:
        print("❌ Black 导入失败:", e)
    
    try:
        import mypy.version
        print("✅ Mypy:", mypy.version.__version__)
    except (ImportError, AttributeError) as e:
        print("❌ Mypy 导入失败:", e)
    
    print("\n✨ 环境测试完成！")

if __name__ == "__main__":
    test_imports()
