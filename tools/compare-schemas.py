#!/usr/bin/env python3
"""
Schema Comparison Tool for Local vs Production Supabase Databases
Compares database schemas and reports differences
"""

import os
import json
import sys
from typing import Dict, List, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

try:
    import psycopg2
    from psycopg2 import sql
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 is required. Install with: pip install psycopg2-binary")
    sys.exit(1)


def get_local_connection():
    """Connect to local Supabase database"""
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=54322,
            database="postgres",
            user="postgres",
            password="postgres",
            connect_timeout=5
        )
        print("✓ Connected to LOCAL database (localhost:54322)")
        return conn
    except Exception as e:
        print(f"✗ Failed to connect to LOCAL database: {e}")
        return None


def get_production_connection():
    """Connect to production Supabase database"""
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Extract host from URL (https://xxxxx.supabase.co -> xxxxx.supabase.co)
    if "supabase.co" in supabase_url:
        host = supabase_url.replace("https://", "").replace("http://", "").replace("/", "")
    else:
        print("✗ Invalid SUPABASE_URL in .env")
        return None
    
    try:
        conn = psycopg2.connect(
            host=host,
            port=5432,
            database="postgres",
            user="postgres",
            password=supabase_key,
            connect_timeout=5,
            sslmode="require"
        )
        print(f"✓ Connected to PRODUCTION database ({host})")
        return conn
    except Exception as e:
        print(f"✗ Failed to connect to PRODUCTION database: {e}")
        print(f"  Host: {host}")
        print(f"  URL: {supabase_url}")
        return None


def get_schema_info(conn, db_name: str) -> Dict[str, Any]:
    """Extract schema information from database"""
    schema_info = {
        "tables": {},
        "views": {},
        "functions": {},
        "triggers": {},
        "indexes": {},
    }
    
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Get tables
        cur.execute("""
            SELECT 
                t.tablename as name,
                obj_description(pgc.oid, 'pg_class') as comment
            FROM pg_tables t
            JOIN pg_class pgc ON pgc.relname = t.tablename
            WHERE t.schemaname = 'public'
            ORDER BY t.tablename
        """)
        tables = cur.fetchall()
        
        for table in tables:
            table_name = table['name']
            
            # Get columns for this table
            cur.execute("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
            """, (table_name,))
            
            columns = cur.fetchall()
            col_list = []
            for col in columns:
                col_list.append({
                    "name": col['column_name'],
                    "type": col['data_type'],
                    "nullable": col['is_nullable'],
                    "default": col['column_default'],
                })
            
            # Get primary key
            cur.execute("""
                SELECT constraint_name, column_name
                FROM information_schema.key_column_usage
                WHERE table_schema = 'public' AND table_name = %s
                  AND constraint_name LIKE '%_pk' OR constraint_name LIKE '%_pkey'
            """, (table_name,))
            pk = cur.fetchall()
            
            # Get foreign keys
            cur.execute("""
                SELECT 
                    constraint_name,
                    column_name,
                    referenced_table_name,
                    referenced_column_name
                FROM information_schema.referential_constraints rc
                JOIN information_schema.key_column_usage kcu 
                  ON rc.constraint_name = kcu.constraint_name
                WHERE kcu.table_schema = 'public' AND kcu.table_name = %s
            """, (table_name,))
            fks = cur.fetchall()
            
            schema_info["tables"][table_name] = {
                "columns": col_list,
                "primary_keys": [p['column_name'] for p in pk],
                "foreign_keys": len(fks),
            }
        
        # Get views
        cur.execute("""
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        views = cur.fetchall()
        schema_info["views"] = {v['table_name']: True for v in views}
        
        # Get functions
        cur.execute("""
            SELECT 
                routine_name,
                routine_type
            FROM information_schema.routines
            WHERE routine_schema = 'public'
            ORDER BY routine_name
        """)
        functions = cur.fetchall()
        schema_info["functions"] = {f['routine_name']: f['routine_type'] for f in functions}
        
    except Exception as e:
        print(f"Error extracting schema info: {e}")
    finally:
        cur.close()
    
    return schema_info


def compare_schemas(local_schema: Dict[str, Any], prod_schema: Dict[str, Any]) -> Dict[str, List[str]]:
    """Compare local and production schemas"""
    differences = {
        "missing_in_local": [],
        "missing_in_prod": [],
        "column_differences": [],
        "type_differences": [],
    }
    
    local_tables = set(local_schema["tables"].keys())
    prod_tables = set(prod_schema["tables"].keys())
    
    # Find missing tables
    for table in prod_tables - local_tables:
        differences["missing_in_local"].append(f"Table: {table}")
    
    for table in local_tables - prod_tables:
        differences["missing_in_prod"].append(f"Table: {table}")
    
    # Compare common tables
    for table in local_tables & prod_tables:
        local_cols = {c['name']: c for c in local_schema["tables"][table]["columns"]}
        prod_cols = {c['name']: c for c in prod_schema["tables"][table]["columns"]}
        
        local_col_names = set(local_cols.keys())
        prod_col_names = set(prod_cols.keys())
        
        # Missing columns
        for col in prod_col_names - local_col_names:
            differences["missing_in_local"].append(f"  Column: {table}.{col}")
        
        for col in local_col_names - prod_col_names:
            differences["missing_in_prod"].append(f"  Column: {table}.{col}")
        
        # Type mismatches
        for col in local_col_names & prod_col_names:
            if local_cols[col]['type'] != prod_cols[col]['type']:
                differences["type_differences"].append(
                    f"  {table}.{col}: local={local_cols[col]['type']}, prod={prod_cols[col]['type']}"
                )
    
    return differences


def print_report(differences: Dict[str, List[str]]):
    """Print comparison report"""
    print("\n" + "="*80)
    print("SCHEMA COMPARISON REPORT")
    print("="*80)
    
    has_diff = False
    
    if differences["missing_in_local"]:
        has_diff = True
        print("\n⚠️  MISSING IN LOCAL (present in production):")
        for item in differences["missing_in_local"]:
            print(f"  - {item}")
    
    if differences["missing_in_prod"]:
        has_diff = True
        print("\n⚠️  EXTRA IN LOCAL (not in production):")
        for item in differences["missing_in_prod"]:
            print(f"  - {item}")
    
    if differences["type_differences"]:
        has_diff = True
        print("\n⚠️  TYPE MISMATCHES:")
        for item in differences["type_differences"]:
            print(f"  - {item}")
    
    print("\n" + "="*80)
    if not has_diff:
        print("✓ SCHEMAS ARE IN SYNC!")
    else:
        print("✗ SCHEMAS HAVE DIFFERENCES - Synchronization needed")
    print("="*80 + "\n")
    
    return not has_diff


def main():
    print("LigaInterna Database Schema Comparison Tool")
    print("-" * 80)
    
    # Connect to databases
    local_conn = get_local_connection()
    prod_conn = get_production_connection()
    
    if not local_conn or not prod_conn:
        print("\n✗ Failed to connect to one or both databases")
        sys.exit(1)
    
    try:
        # Extract schemas
        print("\nExtracting LOCAL schema...")
        local_schema = get_schema_info(local_conn, "local")
        print(f"  Found: {len(local_schema['tables'])} tables, {len(local_schema['views'])} views")
        
        print("\nExtracting PRODUCTION schema...")
        prod_schema = get_schema_info(prod_conn, "production")
        print(f"  Found: {len(prod_schema['tables'])} tables, {len(prod_schema['views'])} views")
        
        # Compare
        print("\nComparing schemas...")
        differences = compare_schemas(local_schema, prod_schema)
        
        # Report
        in_sync = print_report(differences)
        
        # Exit code
        sys.exit(0 if in_sync else 1)
        
    finally:
        if local_conn:
            local_conn.close()
        if prod_conn:
            prod_conn.close()


if __name__ == "__main__":
    main()
