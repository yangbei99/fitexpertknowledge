"""
主应用测试
"""

import pytest
from src.main import app


@pytest.fixture
def client():
    """创建测试客户端"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_home(client):
    """测试首页路由"""
    response = client.get('/')
    assert response.status_code == 200
    data = response.get_json()
    assert 'message' in data
    assert data['status'] == 'running'


def test_health_check(client):
    """测试健康检查端点"""
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'


def test_api_info(client):
    """测试API信息端点"""
    response = client.get('/api/info')
    assert response.status_code == 200
    data = response.get_json()
    assert 'api_version' in data
    assert 'endpoints' in data
    assert len(data['endpoints']) > 0
