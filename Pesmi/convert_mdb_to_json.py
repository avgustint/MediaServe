#!/usr/bin/env python3
"""
Convert Microsoft Access MDB file to JSON format.
Uses mdbtools command-line utilities to extract data.
"""

import json
import subprocess
import sys
import os
import csv
import io
from pathlib import Path

def get_tables(mdb_file):
    """Get list of tables from MDB file."""
    try:
        result = subprocess.run(
            ['mdb-tables', mdb_file],
            capture_output=True,
            text=True,
            check=True
        )
        tables = [t.strip() for t in result.stdout.strip().split() if t.strip()]
        return tables
    except subprocess.CalledProcessError as e:
        print(f"Error getting tables: {e}", file=sys.stderr)
        return []

def export_table_to_csv(mdb_file, table_name):
    """Export a table to CSV format using mdb-export."""
    try:
        result = subprocess.run(
            ['mdb-export', mdb_file, table_name],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error exporting table {table_name}: {e}", file=sys.stderr)
        return None

def csv_to_json(csv_data, table_name):
    """Convert CSV data to JSON format."""
    if not csv_data:
        return []
    
    rows = []
    try:
        # Use Python's csv module for proper parsing
        csv_reader = csv.DictReader(io.StringIO(csv_data))
        for row_dict in csv_reader:
            # Convert values to appropriate types
            processed_row = {}
            for key, value in row_dict.items():
                if value == "" or value is None:
                    processed_row[key] = None
                elif value.lower() == 'true':
                    processed_row[key] = True
                elif value.lower() == 'false':
                    processed_row[key] = False
                else:
                    # Try to convert to number
                    try:
                        if '.' in value:
                            processed_row[key] = float(value)
                        else:
                            processed_row[key] = int(value)
                    except ValueError:
                        processed_row[key] = value
            rows.append(processed_row)
    except Exception as e:
        print(f"  Warning: Error parsing CSV for table {table_name}: {e}", file=sys.stderr)
        return []
    
    return rows

def convert_mdb_to_json(mdb_file, output_file=None):
    """Convert MDB file to JSON format."""
    mdb_path = Path(mdb_file)
    if not mdb_path.exists():
        print(f"Error: MDB file not found: {mdb_file}", file=sys.stderr)
        return False
    
    if output_file is None:
        output_file = mdb_path.with_suffix('.json')
    else:
        output_file = Path(output_file)
    
    print(f"Reading MDB file: {mdb_file}")
    
    # Get all tables
    tables = get_tables(mdb_file)
    if not tables:
        print("No tables found in MDB file", file=sys.stderr)
        return False
    
    print(f"Found {len(tables)} tables: {', '.join(tables)}")
    
    # Convert each table
    result = {
        "database": mdb_path.stem,
        "tables": {}
    }
    
    for table in tables:
        print(f"Converting table: {table}")
        csv_data = export_table_to_csv(mdb_file, table)
        if csv_data:
            json_data = csv_to_json(csv_data, table)
            result["tables"][table] = json_data
            print(f"  - {len(json_data)} rows")
        else:
            print(f"  - Failed to export table")
            result["tables"][table] = []
    
    # Write JSON file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\nSuccessfully converted to: {output_file}")
        print(f"Total tables: {len(result['tables'])}")
        total_rows = sum(len(rows) for rows in result['tables'].values())
        print(f"Total rows: {total_rows}")
        return True
    except Exception as e:
        print(f"Error writing JSON file: {e}", file=sys.stderr)
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 convert_mdb_to_json.py <mdb_file> [output_file]")
        sys.exit(1)
    
    mdb_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    success = convert_mdb_to_json(mdb_file, output_file)
    sys.exit(0 if success else 1)

