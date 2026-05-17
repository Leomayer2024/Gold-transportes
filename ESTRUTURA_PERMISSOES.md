# 🏗️ Estrutura de Permissões e Aprovações - SEG Web + SEG App

## Visão Geral

O sistema foi reorganizado para suportar:
- **SEG Web**: Aplicação web completa (admin, gestor, RH)
- **SEG App**: Aplicação mobile/app para motoristas e operadores (acesso limitado)
- **Sistema de Aprovações**: Rastreia quem aprovou, quando e com quais comentários

---

## 📁 Novos Arquivos

### 1. `permissions_config.py`
Define as roles e menus permitidos por plataforma:

```python
ACCESS_TYPES = {
    'web': {
        'admin': {...},      # Acesso total
        'gestor': {...},     # Gestor
        'rh': {...},         # RH
    },
    'app': {
        'motorista': {...},  # Motorista no app
        'operador': {...},   # Operador no app
    }
}
```

### 2. `platform_middleware.py`
Detecta automaticamente se é APP ou WEB:

```python
detect_platform()  # Retorna 'app' ou 'web'

# Decorator para restringir acesso
@require_platform('web')  # Só web
@require_platform('app')   # Só app

# Decorator para validar roles por plataforma
@platform_specific_role(
    web_roles=['admin', 'gestor'],
    app_roles=['motorista']
)
```

### 3. `approval_manager.py`
Sistema de aprovações com rastreamento de nomes:

```python
# Cria registro de aprovação com nome do aprovador
create_approval_record(
    supabase,
    profile,              # Dados do colaborador que está aprovando
    'manutencoes',        # Tipo de recurso
    item_id,
    'approve',            # ou 'reject'
    comment='Aprovado'
)

# Verifica status de aprovação
check_approval_status(supabase, 'manutencoes', item_id)
# Retorna: {
#     'status': 'approved' | 'pending',
#     'approved_by': [
#         {'name': 'João Silva', 'id': 1, 'timestamp': '...'}
#     ],
#     'pending': [...]  # Quem ainda precisa aprovar
# }
```

### 4. `approval_endpoints.py`
Novos endpoints para aprovações:

```
GET  /api/approvals/<id>/status              # Status com nomes
GET  /api/approvals/<id>/history             # Histórico
POST /api/approvals/<id>/approve             # Aprovar com nome
POST /api/approvals/<id>/reject              # Rejeitar com razão
GET  /api/approvals/required-approvers       # Quem deve aprovar
```

---

## 🔑 Como Usar

### 1. No Frontend (React)

```javascript
// Detectar plataforma
const platform = navigator.userAgent.includes('Expo') ? 'app' : 'web';

// Header para indicar plataforma
const headers = {
    'Content-Type': 'application/json',
    'X-Platform': platform,  // 'app' ou 'web'
    'Authorization': `Bearer ${token}`
};

// Aprovar com nome
const response = await fetch('/api/approvals/123/approve', {
    method: 'POST',
    headers,
    body: JSON.stringify({
        resource_type: 'manutencoes',
        comment: 'Aprovado pelo gestor'
    })
});
// Retorna: {
//     'status': 'ok',
//     'message': 'Aprovado por João Silva',
//     'approval_status': {...}
// }
```

### 2. No Backend (Python)

```python
# Verificar plataforma
from platform_middleware import detect_platform
platform = detect_platform()  # 'app' ou 'web'

# Usar no decorator
@app.post('/api/meu-endpoint')
@require_platform('web')  # Só web
def meu_endpoint():
    pass

# Obter menu baseado em plataforma
from platform_middleware import get_menu_for_platform
menu = get_menu_for_platform(profile)  # ['dashboard', 'colaboradores', ...]
```

---

## 🧐 Fluxo de Aprovação Exemplo

### Manutencoes (Web)
1. Admin cria manutenção
2. Sistema identifica que precisa aprovação de: `[gestor, admin]`
3. Gestor aprova → `approved_by: [{name: 'Gestor 1', ...}]`
4. Admin aprova → `approved_by: [{name: 'Gestor 1', ...}, {name: 'Admin', ...}]`
5. Status muda para `'approved'`

### Horas Extras (Web)
1. Colaborador registra horas extras
2. Sistema identifica que precisa aprovação de: `[rh, gestor]` (allow_partial: true)
3. RH aprova → `status: 'approved'` (qualquer um basta)
4. Gestor pode também aprovar ou não

---

## 🚀 Próximos Passos

1. **Integrar no `app.py`**: Adicionar import e setup dos endpoints
2. **Atualizar banco de dados**: Adicionar campos em `auditoria_movimentacoes`:
   - `colaborador_nome` (string)
   - `details` (json) - detalhes da aprovação

3. **Frontend**: Usar novo endpoint `/api/approvals/<id>/history` para mostrar:
   - Quem aprovou
   - Quando
   - Com qual comentário

4. **Mobile App**: Ajustar endpoints de aprovação baseado em rol (motorista/operador não podem aprovar)

---

## 📊 Resumo de Permissões

| Recurso | Web | App |
|---------|-----|-----|
| Dashboard | admin, gestor, rh | motorista, operador |
| Colaboradores | admin, rh | ❌ |
| Veículos | admin, gestor | motorista (read-only) |
| Aprovações | admin, gestor, rh | ❌ |
| Abastecimentos | admin, gestor | motorista, operador (read/create) |
| Permissões | admin | ❌ |
| Auditoria | admin | ❌ |

