#!/bin/bash

echo "================================="
echo " Build Automático - SEG"
echo "================================="
echo ""

cd frontend
echo "[1/3] Instalando dependências..."
npm install

echo ""
echo "[2/3] Compilando frontend..."
npm run build

echo ""
echo "[3/3] Concluído!"
echo ""
echo "Pasta criada: frontend/dist/"
echo ""
