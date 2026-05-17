"""
Endpoints para sistema de aprovações com rastreamento de aprovadores
Integrar em app.py dentro da função create_app()
"""

def setup_approval_endpoints(app, supabase, require_auth, rate_limit_endpoint):
    """
    Configure approval endpoints with approver name tracking
    """
    from flask import request, jsonify
    from approval_manager import (
        create_approval_record, 
        check_approval_status, 
        get_approval_history,
        get_required_approvers
    )
    from platform_middleware import detect_platform, platform_specific_role
    
    @app.get('/api/approvals/<int:item_id>/status')
    @rate_limit_endpoint(max_requests=60)
    @require_auth
    def get_approval_status_api(profile, item_id):
        """
        Retorna status completo de aprovação com nomes dos aprovadores
        Query params:
          - resource_type: obrigatório (manutencoes, pedidos_compra, etc)
          - platform: opcional (web/app, detectado automaticamente)
        """
        resource_type = request.args.get('resource_type', '').strip().lower()
        platform = request.args.get('platform', detect_platform())
        
        if not resource_type:
            return jsonify({'error': 'resource_type é obrigatório'}), 400
        
        try:
            status = check_approval_status(supabase, resource_type, item_id, platform)
            return jsonify(status)
        except Exception as exc:
            app.logger.error('Erro ao obter status de aprovação: %s', exc)
            return jsonify({'error': str(exc)}), 500
    
    
    @app.post('/api/approvals/<int:item_id>/approve')
    @rate_limit_endpoint(max_requests=30)
    @require_auth
    def approve_with_name_api(profile, item_id):
        """
        Aprova um item e registra nome completo do aprovador
        Body:
          - resource_type: obrigatório
          - comment: opcional (comentário do aprovador)
        """
        body = request.get_json(silent=True) or {}
        resource_type = (body.get('resource_type') or '').strip().lower()
        comment = (body.get('comment') or '').strip()
        
        if not resource_type:
            return jsonify({'error': 'resource_type é obrigatório'}), 400
        
        try:
            # Registra aprovação com nome do colaborador
            success = create_approval_record(
                supabase,
                profile,
                resource_type,
                item_id,
                action='approve',
                comment=comment,
                details={
                    'approved_by_name': profile.get('nome_completo'),
                    'approved_by_email': profile.get('email'),
                    'approved_by_role': profile.get('role'),
                }
            )
            
            if not success:
                return jsonify({'error': 'Falha ao registrar aprovação'}), 500
            
            # Verifica novo status
            status = check_approval_status(supabase, resource_type, item_id)
            
            return jsonify({
                'status': 'ok',
                'message': f'Aprovado por {profile.get("nome_completo")}',
                'approval_status': status
            })
        except Exception as exc:
            app.logger.error('Erro ao aprovar: %s', exc)
            return jsonify({'error': str(exc)}), 500
    
    
    @app.post('/api/approvals/<int:item_id>/reject')
    @rate_limit_endpoint(max_requests=30)
    @require_auth
    def reject_with_name_api(profile, item_id):
        """
        Rejeita um item e registra razão com nome do rejeitador
        Body:
          - resource_type: obrigatório
          - reason: obrigatório (motivo da rejeição)
        """
        body = request.get_json(silent=True) or {}
        resource_type = (body.get('resource_type') or '').strip().lower()
        reason = (body.get('reason') or '').strip()
        
        if not resource_type:
            return jsonify({'error': 'resource_type é obrigatório'}), 400
        if not reason:
            return jsonify({'error': 'reason é obrigatório'}), 400
        
        try:
            # Registra rejeição com nome
            success = create_approval_record(
                supabase,
                profile,
                resource_type,
                item_id,
                action='reject',
                comment=reason,
                details={
                    'rejected_by_name': profile.get('nome_completo'),
                    'rejected_by_email': profile.get('email'),
                    'rejected_by_role': profile.get('role'),
                }
            )
            
            if not success:
                return jsonify({'error': 'Falha ao registrar rejeição'}), 500
            
            return jsonify({
                'status': 'ok',
                'message': f'Rejeitado por {profile.get("nome_completo")}',
                'reason': reason
            })
        except Exception as exc:
            app.logger.error('Erro ao rejeitar: %s', exc)
            return jsonify({'error': str(exc)}), 500
    
    
    @app.get('/api/approvals/<int:item_id>/history')
    @rate_limit_endpoint(max_requests=60)
    @require_auth
    def get_approval_history_api(profile, item_id):
        """
        Retorna histórico completo de aprovações com nomes
        Query params:
          - resource_type: obrigatório
        """
        resource_type = request.args.get('resource_type', '').strip().lower()
        
        if not resource_type:
            return jsonify({'error': 'resource_type é obrigatório'}), 400
        
        try:
            history = get_approval_history(supabase, resource_type, item_id)
            return jsonify({'items': history})
        except Exception as exc:
            app.logger.error('Erro ao obter histórico: %s', exc)
            return jsonify({'error': str(exc)}), 500
    
    
    @app.get('/api/approvals/required-approvers')
    @rate_limit_endpoint(max_requests=60)
    @require_auth
    def get_required_approvers_api(profile):
        """
        Retorna lista de aprovadores obrigatórios para um tipo de recurso
        Query params:
          - resource_type: obrigatório
          - platform: opcional (web/app, detectado automaticamente)
        """
        resource_type = request.args.get('resource_type', '').strip().lower()
        platform = request.args.get('platform', detect_platform())
        
        if not resource_type:
            return jsonify({'error': 'resource_type é obrigatório'}), 400
        
        try:
            approvers = get_required_approvers(supabase, resource_type, platform)
            return jsonify({
                'resource_type': resource_type,
                'platform': platform,
                'approvers': approvers
            })
        except Exception as exc:
            app.logger.error('Erro ao obter aprovadores obrigatórios: %s', exc)
            return jsonify({'error': str(exc)}), 500

    return app
