"""
Middleware para detectar plataforma (APP vs WEB) e validar permissões
"""
from flask import request
from functools import wraps

def detect_platform():
    """
    Detecta se a requisição vem do app ou web
    Verifica: User-Agent, headers customizados, ou defaults para 'web'
    """
    user_agent = request.headers.get('User-Agent', '').lower()
    platform_header = request.headers.get('X-Platform', '').lower()
    
    # Header explícito tem prioridade
    if platform_header in ['app', 'web']:
        return platform_header
    
    # Detectar por User-Agent
    if 'react-native' in user_agent or 'expo' in user_agent:
        return 'app'
    if 'mobile' in user_agent or 'android' in user_agent or 'iphone' in user_agent:
        return 'app'
    
    # Default
    return 'web'


def require_platform(platform: str):
    """
    Decorator que restringe acesso apenas à plataforma especificada
    
    @require_platform('web') -> Apenas web pode acessar
    @require_platform('app')  -> Apenas app pode acessar
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            detected = detect_platform()
            if detected != platform:
                return {'error': f'Este endpoint é apenas para {platform}'}, 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def platform_specific_role(web_roles=None, app_roles=None):
    """
    Decorator que valida roles baseado na plataforma
    
    @platform_specific_role(
        web_roles=['admin', 'gestor'],
        app_roles=['motorista']
    )
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(profile, *args, **kwargs):
            platform = detect_platform()
            user_role = profile.get('role', '')
            
            allowed_roles = web_roles if platform == 'web' else app_roles
            
            if allowed_roles and user_role not in allowed_roles:
                return {
                    'error': f'Role {user_role} não permitida nesta plataforma'
                }, 403
            
            return f(profile, *args, **kwargs)
        return decorated_function
    return decorator


def get_menu_for_platform(profile):
    """
    Retorna menu permitido baseado em plataforma e role
    """
    from permissions_config import ACCESS_TYPES
    
    platform = detect_platform()
    role = profile.get('role', '')
    
    if platform not in ACCESS_TYPES or role not in ACCESS_TYPES[platform]:
        return []
    
    return ACCESS_TYPES[platform][role].get('menus', [])
