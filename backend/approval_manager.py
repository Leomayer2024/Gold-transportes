"""
Sistema de Aprovações com Rastreamento de Aprovadores
Permite rastrear quem aprovou, quando e com comentários
"""
from datetime import datetime
from typing import Dict, List, Optional

def get_approval_history(supabase, resource_type: str, item_id: int) -> List[Dict]:
    """
    Retorna histórico de aprovações/rejeições com nomes dos aprovadores
    """
    try:
        response = supabase.table('auditoria_movimentacoes').select(
            'id, criado_em, acao, colaborador_id, colaboradores(nome_completo), details'
        ).eq('recurso', resource_type).eq('recurso_id', item_id).in_(
            'acao', ['approve', 'reject']
        ).order('criado_em', desc=True).execute()
        
        return response.data or []
    except Exception as e:
        return []


def create_approval_record(supabase, profile: Dict, resource_type: str, item_id: int, 
                          action: str, comment: str = '', details: Dict = None) -> bool:
    """
    Cria registro de aprovação/rejeição com nome e detalhes do aprovador
    
    Args:
        supabase: Cliente Supabase
        profile: Perfil do colaborador que está aprovando
        resource_type: Tipo de recurso (manutencoes, pedidos_compra, etc)
        item_id: ID do item sendo aprovado
        action: 'approve' ou 'reject'
        comment: Comentário opcional do aprovador
        details: Detalhes adicionais
    """
    try:
        approval_record = {
            'recurso': resource_type,
            'recurso_id': item_id,
            'acao': action,
            'colaborador_id': profile.get('id'),
            'colaborador_nome': profile.get('nome_completo'),
            'comentario': comment,
            'criado_em': datetime.now().isoformat(),
            'details': details or {}
        }
        
        result = supabase.table('auditoria_movimentacoes').insert(approval_record).execute()
        return bool(result.data)
    except Exception as e:
        return False


def get_required_approvers(supabase, resource_type: str, platform: str = 'web') -> List[Dict]:
    """
    Retorna lista de aprovadores obrigatórios para um tipo de recurso
    """
    from permissions_config import APPROVAL_WORKFLOWS
    
    if resource_type not in APPROVAL_WORKFLOWS:
        return []
    
    workflow = APPROVAL_WORKFLOWS[resource_type].get(platform)
    if not workflow:
        return []
    
    required_roles = workflow['approvers_required']
    
    try:
        # Busca colaboradores com as roles obrigatórias
        placeholders = ','.join(f"'{role}'" for role in required_roles)
        response = supabase.table('colaboradores').select(
            'id, nome_completo, email, cargo'
        ).in_('role', required_roles).eq('ativo', True).execute()
        
        return response.data or []
    except Exception as e:
        return []


def check_approval_status(supabase, resource_type: str, item_id: int, 
                         platform: str = 'web') -> Dict:
    """
    Verifica status de aprovações para um item
    Retorna quem já aprovou e quem ainda precisa aprovar
    """
    from permissions_config import APPROVAL_WORKFLOWS
    
    workflow = APPROVAL_WORKFLOWS.get(resource_type, {}).get(platform)
    if not workflow:
        return {'status': 'not_applicable', 'approved_by': [], 'pending': []}
    
    # Histórico de aprovações
    history = get_approval_history(supabase, resource_type, item_id)
    approved_by = [
        {
            'name': h['colaboradores']['nome_completo'],
            'id': h['colaborador_id'],
            'timestamp': h['criado_em'],
        }
        for h in history if h['acao'] == 'approve'
    ]
    
    # Aprovadores obrigatórios
    required_approvers = get_required_approvers(supabase, resource_type, platform)
    approved_ids = [a['id'] for a in approved_by]
    pending = [a for a in required_approvers if a['id'] not in approved_ids]
    
    # Verificar se precisa de mais aprovações
    allow_partial = workflow.get('allow_partial', False)
    is_approved = len(approved_by) > 0 if allow_partial else len(pending) == 0
    
    return {
        'status': 'approved' if is_approved else 'pending',
        'approved_by': approved_by,
        'pending': pending,
        'allow_partial': allow_partial,
        'total_required': len(required_approvers),
    }
