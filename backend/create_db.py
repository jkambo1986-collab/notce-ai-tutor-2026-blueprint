
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_database():
    try:
        # Connect to default 'postgres' database
        con = psycopg2.connect(
            dbname='postgres',
            user='postgres',
            host='localhost',
            password='Dexter1'
        )
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
