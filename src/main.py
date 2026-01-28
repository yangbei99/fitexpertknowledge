#!/usr/bin/env python3
"""
示例Flask应用
"""

from flask import Flask, jsonify
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')


@app.route('/')
def home():
    """首页路由"""
    return jsonify({
        'message': 'Welcome to FitExpertKnowledge API',
        'version': '0.1.0',
        'status': 'running'
    })


@app.route('/health')
def health_check():
    """健康检查端点"""
    return jsonify({
        'status': 'healthy',
        'service': 'FitExpertKnowledge'
    })


@app.route('/api/info')
def api_info():
    """API信息"""
    return jsonify({
        'api_version': 'v1',
        'endpoints': [
            {'path': '/', 'method': 'GET', 'description': '首页'},
            {'path': '/health', 'method': 'GET', 'description': '健康检查'},
            {'path': '/api/info', 'method': 'GET', 'description': 'API信息'}
        ]
    })


if __name__ == '__main__':
    debug_mode = os.getenv('DEBUG', 'True').lower() == 'true'
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)
