import pymysql

pymysql.install_as_MySQLdb()

# Bypass strict MySQL version check to support MySQL 8.0.x on Windows
from django.db.backends.base.base import BaseDatabaseWrapper
BaseDatabaseWrapper.check_database_version_supported = lambda self: None
