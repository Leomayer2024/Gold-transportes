"""
Estrutura de Permissões para SEG Web e SEG App

APP: Acesso limitado (motorista, operador básico)
WEB: Acesso completo (administrador, gestor, RH)
"""

# Tipos de acesso por plataforma
ACCESS_TYPES = {
    'web': {
        'admin': {
            'label': 'Administrador Web',
            'menus': ['dashboard', 'colaboradores', 'veiculos', 'financeiro', 'permissoes', 'auditoria'],
            'can_approve': True,
            'can_manage_users': True,
        },
        'gestor': {
            'label': 'Gestor Web',
            'menus': ['dashboard', 'colaboradores', 'veiculos', 'abastecimentos', 'custos_rh'],
            'can_approve': True,
            'can_manage_users': False,
        },
        'rh': {
            'label': 'RH Web',
            'menus': ['colaboradores', 'eventos_rh', 'bonificacao', 'presenca'],
            'can_approve': False,
            'can_manage_users': False,
        },
    },
    'app': {
        'motorista': {
            'label': 'Motorista (App)',
            'menus': ['dashboard_simples', 'minhas_jornadas', 'abastecimentos_proprios'],
            'can_approve': False,
            'can_manage_users': False,
        },
        'operador': {
            'label': 'Operador (App)',
            'menus': ['dashboard_simples', 'carregamentos', 'abastecimentos'],
            'can_approve': False,
            'can_manage_users': False,
        },
    }
}

# Fluxos de aprovação por tipo de recurso
APPROVAL_WORKFLOWS = {
    'manutencoes': {
        'web': {
            'approvers_required': ['gestor', 'admin'],
            'allow_partial': False,  # Todos precisam aprovar
            'priority': 'high',
        },
        'app': None,  # App não pode aprovar
    },
    'pedidos_compra': {
        'web': {
            'approvers_required': ['admin'],
            'allow_partial': False,
            'priority': 'high',
        },
        'app': None,
    },
    'horas_extras': {
        'web': {
            'approvers_required': ['rh', 'gestor'],
            'allow_partial': True,  # Qualquer um pode aprovar
            'priority': 'medium',
        },
        'app': None,
    },
    'abastecimentos': {
        'web': {
            'approvers_required': ['gestor'],
            'allow_partial': False,
            'priority': 'low',
        },
        'app': None,
    },
}
