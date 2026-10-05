scp -P 5903 requirements.txt root@10.210.14.71:/u01/pipeline/
scp -P 5903 config.yaml root@10.210.14.71:/u01/pipeline/
# scp -P 5903 init.sh root@10.210.14.71:/u01/pipeline/
scp -P 5903 start.sh root@10.210.14.71:/u01/pipeline/

scp -P 5903 scripts/remote69.sh root@10.210.14.71:/u01/pipeline/scripts/

scp -P 5903 .env.example root@10.210.14.71:/u01/pipeline/.env

scp -P 5903 -r app root@10.210.14.71:/u01/pipeline/
scp -P 5903 -r .venv root@10.210.14.71:/u01/pipeline/