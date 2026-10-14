#!/usr/bin/env python3
"""
Root-level wrapper to reset the IGGL Portal database.
Usage:
    python clear_db.py
    or
    ./backend/venv/bin/python clear_db.py
"""
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / 'backend'

# If virtualenv python exists and we are not using it, recommend or execute directly
sys.path.insert(0, str(BACKEND_DIR))

from reset_db import clear_database

if __name__ == '__main__':
    clear_database(preserve_admin=True)
