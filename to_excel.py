import json
import pandas as pd

with open('clean_snapshots.json', encoding='utf-8') as f:
    data = json.load(f)

df = pd.DataFrame(data)
df.to_excel('clean_snapshots.xlsx', index=False)