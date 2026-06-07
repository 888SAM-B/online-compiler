import sys
import os
import json
import gzip
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient

def convert_types(val, key=None):
    if isinstance(val, dict):
        return {k: convert_types(v, k) for k, v in val.items()}
    elif isinstance(val, list):
        return [convert_types(x, key) for x in val]
    elif isinstance(val, str):
        # Convert 24-character hex strings to ObjectId ONLY for _id fields
        # Other ID fields (like user_id, challenge_id) are stored as strings in the app
        if key == '_id' and len(val) == 24:
            try:
                return ObjectId(val)
            except Exception:
                pass
        
        # Convert ISO format date strings back to datetime objects
        try:
            # Check for standard ISO format: YYYY-MM-DDTHH:MM:SS
            if len(val) >= 19 and val[4] == '-' and val[7] == '-' and val[10] == 'T':
                return datetime.fromisoformat(val)
        except ValueError:
            pass
            
    return val

def main():
    if len(sys.argv) < 2:
        print("Usage: python restore_backup.py <path_to_backup_file.json.gz>")
        print("Example: python restore_backup.py C:\\Users\\Name\\Downloads\\mongodb_backup_20260607.json.gz")
        sys.exit(1)
        
    backup_path = sys.argv[1]
    if not os.path.exists(backup_path):
        print(f"Error: File '{backup_path}' not found.")
        sys.exit(1)
        
    # Connect to MongoDB (Port 27018 is mapped from Docker to localhost)
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27018")
    db_name = os.environ.get("DB_NAME", "online_compiler")
    
    print(f"Connecting to MongoDB at: {mongo_uri}")
    print(f"Target Database: {db_name}")
    
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        # Test connection
        client.admin.command('ping')
        db = client[db_name]
    except Exception as e:
        print(f"\nError: Could not connect to MongoDB server.")
        print(f"Details: {e}")
        print("Please ensure MongoDB Docker container is running and port 27018 is active.")
        sys.exit(1)
        
    print(f"Reading and unzipping backup file: {backup_path}...")
    try:
        with gzip.open(backup_path, 'rt', encoding='utf-8') as f:
            backup_data = json.load(f)
    except Exception as e:
        print(f"Failed to read backup: {e}")
        sys.exit(1)
        
    print("\nStarting Restoration Process...")
    for col_name, docs in backup_data.items():
        if not docs:
            print(f"  [-] Collection '{col_name}' is empty. Skipping...")
            continue
            
        print(f"  [+] Restoring collection '{col_name}' ({len(docs)} documents)...")
        
        # Clear existing collection data to prevent duplicate keys
        db[col_name].drop()
        
        # Convert strings back to ObjectIds and datetimes
        typed_docs = [convert_types(doc) for doc in docs]
        
        # Restore into MongoDB
        db[col_name].insert_many(typed_docs)
        
    print("\nDatabase restoration completed successfully!")

if __name__ == "__main__":
    main()
