#!/usr/bin/env python
"""One-shot script to force-sync UFT paths from seed XML. Run as:
   cd backend && venv/bin/python sync_uft_now.py
"""
import os, sys, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.gta.services.uft_service import sync_uft_master_paths

result = sync_uft_master_paths(force_seed=True)
print(f"Source       : {result['source']}")
print(f"Synced paths : {result['count']}")
print(f"Deactivated  : {result.get('deactivated', 0)} stale paths")
print()
for p in result['paths']:
    print(f"  {p['uft_id']:20s} | {p['path_id_desc']:35s} | {p['zone_pngrb']} | tariff={p['applicable_tariff_regime']}")
