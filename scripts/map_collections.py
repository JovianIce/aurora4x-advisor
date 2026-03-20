import json, sqlite3, os

DUMP_DIR = r"C:\Programming\aurora4x-advisor\Dump"
DB_PATH = r"C:\Programming\aurora4x-advisor\AuroraPatch-master\AuroraPatch\bin\Debug\AuroraDB.db"
GAME_ID = 142

db = sqlite3.connect(DB_PATH)

# Get all FCT table counts
db_tables = {}
for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'FCT_%'").fetchall():
    tname = row[0]
    try:
        c = db.execute(f"SELECT COUNT(*) FROM [{tname}] WHERE GameID={GAME_ID}").fetchone()[0]
        if c > 0: db_tables[tname] = c
    except:
        try:
            c = db.execute(f"SELECT COUNT(*) FROM [{tname}]").fetchone()[0]
            if c > 0: db_tables[tname] = c
        except: pass

# Load collections index
with open(os.path.join(DUMP_DIR, "_collections_index.json")) as f:
    collections = json.load(f)

# Already mapped
known = {"bw", "bv", "bu", "b2", "bx", "co", "bm", "bp", "bo", "b8", "cw", "bq", "ch", "ds", "dr", "c6", "cn", "cb", "c4", "dh", "cf", "dg", "d4", "dz"}

print(f"{'Field':<6} {'Type':<8} {'Count':>6}  {'DB Match':<35} {'Verified'}")
print("-" * 95)

for col in sorted(collections, key=lambda c: -c["count"]):
    if col["field"] in known or col["count"] == 0:
        continue

    field = col["field"]
    itype = col["itemType"]
    count = col["count"]

    # Try to load dump file
    fname = f"{field}_{itype}_{count}.json"
    fpath = os.path.join(DUMP_DIR, fname)
    if not os.path.exists(fpath):
        continue

    try:
        with open(fpath, encoding="utf-8") as f:
            data = json.load(f)
    except:
        continue

    if not data.get("items"):
        continue

    item = data["items"][0]
    int_vals = {k: v for k, v in item.items() if isinstance(v, int) and v > 100}
    str_vals = {k: v for k, v in item.items() if isinstance(v, str) and len(v) > 2}

    # Find DB tables with matching count
    exact = [t for t, c in db_tables.items() if c == count]
    close = [t for t, c in db_tables.items() if 0 < abs(c - count) <= max(5, count * 0.05)]

    candidates = exact + close
    result = ""
    verified = ""

    for tname in candidates[:5]:
        try:
            cols = [c[1] for c in db.execute(f"PRAGMA table_info([{tname}])").fetchall()]
            # Try ID columns
            for id_col in [c for c in cols if c.endswith("ID") and c not in ("GameID", "RaceID", "SpeciesID")]:
                try:
                    db_ids = set(r[0] for r in db.execute(f"SELECT [{id_col}] FROM [{tname}] WHERE GameID={GAME_ID} LIMIT 100").fetchall())
                except:
                    db_ids = set(r[0] for r in db.execute(f"SELECT [{id_col}] FROM [{tname}] LIMIT 100").fetchall())

                if not db_ids:
                    continue

                for ik, iv in int_vals.items():
                    if iv in db_ids:
                        result = f"{tname} ({db_tables.get(tname, '?')})"
                        verified = f"{ik}={iv} in {id_col}"
                        break
                if verified:
                    break

            # Try name columns
            if not verified:
                for name_col in [c for c in cols if "Name" in c and c != "GameName"]:
                    try:
                        db_names = set(r[0] for r in db.execute(f"SELECT [{name_col}] FROM [{tname}] WHERE GameID={GAME_ID} LIMIT 100").fetchall() if r[0])
                    except:
                        db_names = set(r[0] for r in db.execute(f"SELECT [{name_col}] FROM [{tname}] LIMIT 100").fetchall() if r[0])

                    for sk, sv in str_vals.items():
                        if sv in db_names:
                            result = f"{tname} ({db_tables.get(tname, '?')})"
                            verified = f'{sk}="{sv}" in {name_col}'
                            break
                    if verified:
                        break
        except:
            pass

        if verified:
            break

    if not result and exact:
        result = f"{exact[0]} ({db_tables[exact[0]]})"
        verified = "count match only"
    elif not result and close:
        result = f"~{close[0]} ({db_tables[close[0]]})"
        verified = "approx count"

    if result:
        print(f"{field:<6} {itype:<8} {count:>6}  {result:<35} {verified}")

db.close()
