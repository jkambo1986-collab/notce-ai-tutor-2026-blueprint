"""One-off helper to create the local PostgreSQL database for development.

Connects to the server's default `postgres` database and creates the
`notce_db` database if it does not already exist (so Django migrations have a
target to run against). Local-dev only — connection details are hard-coded and
production uses a managed database via DATABASE_URL.

Run from the backend directory before the first migration:
    python create_db.py
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_database():
    try:
        # Connect to the server's default 'postgres' maintenance database, since
        # the target database may not exist yet.
        con = psycopg2.connect(
            dbname='postgres',
            user='postgres',
            host='localhost',
            password='Dexter1'
        )
        # CREATE DATABASE cannot run inside a transaction block, so use autocommit.
        con.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = con.cursor()
        
        # Check if database exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'notce_db'")
        exists = cur.fetchone()
        
        if not exists:
            cur.execute('CREATE DATABASE notce_db')
            print("Database 'notce_db' created successfully.")
        else:
            print("Database 'notce_db' already exists.")
            
        cur.close()
        con.close()
        
    except Exception as e:
        print(f"Error creating database: {e}")

if __name__ == '__main__':
    create_database()
