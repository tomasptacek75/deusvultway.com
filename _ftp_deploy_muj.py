"""
Nahraje BloodAndGuts na DENÍKOVOU subdoménu muj.bloodandguts.cz přes FTP: frontend build +
PHP api (php-forpsi/public → /subdoms/muj) a PHP zdrojový kód (php-forpsi/src → /subdoms/muj/src,
chráněno .htaccess "Require all denied"). Stejný FTP účet jako produkce/test — vzor viz
_ftp_deploy_test.py, jen jiná vzdálená cesta.

Předpoklad mimo tenhle skript: subdoména muj.bloodandguts.cz musí být na Forpsi zřízená a DNS
musí resolvovat (obdoba toho, jak byla dřív zřízená test.bloodandguts.cz), jinak nahrávání
skončí na chybě "550 create directory operation failed" nebo podobné.

DŮLEŽITÝ ROZDÍL oproti _ftp_deploy_test.py/_ftp_deploy.py: tenhle skript NIKDY nenahrává
src/config.php (na rozdíl od těch dvou, které config.php nahrávají a tím pádem produkce i test
sdílejí stejný jwt_secret — neškodí jim to, obě mají jen Davidovy/demo uživatele). Muj.bloodandguts.cz
ale bude mít veřejnou self-registraci (role 'diary') a musí mít VLASTNÍ jwt_secret, jinak by token
vydaný pro deníkového uživatele mohl při shodě user_id projít i proti produkční/testovací databázi
(endpointy jako /me nebo assertClientAccess ověřují jen podpis + existenci ID v aktuální DB, ne
který deploy target token vydal). Config.php si proto musí Tomáš na muj.bloodandguts.cz vytvořit
ručně přímo na serveru (jednou, při prvním nasazení) — zkopírovat config.example.php, vyplnit
vlastní jwt_secret (jiný než v lokálním config.php), openai_api_key, anthropic_api_key, a nastavit
'seed_demo' => false, aby se na čerstvou DB nenaseedoval fake David + demo klienti.

Muj má vlastní izolovanou SQLite databázi (vznikne a naseeduje se sama při prvním requestu) —
nikdy nesdílí data s /www ani /subdoms/test.

Použití: nejdřív `npm run build` ve frontend/ (stejný build slouží všem třem cílům, protože
VITE_API_URL je relativní /api), pak `python _ftp_deploy_muj.py`.

Nikdy nenahrává php-forpsi/data/*.db — jen data/.htaccess, aby složka nebyla přístupná přímo přes web.
"""
import ftplib
import os
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from _ftp_credentials import FTP_HOST, FTP_USER, FTP_PASS

LOCAL_PUBLIC = "php-forpsi/public"
LOCAL_SRC = "php-forpsi/src"
LOCAL_DATA_HTACCESS = "php-forpsi/data/.htaccess"
REMOTE_ROOT = "/subdoms/muj"

# config.php se na rozdíl od _ftp_deploy_test.py/_ftp_deploy.py NIKDY nenahrává — viz docstring výš.
SRC_SKIP_FILES = {"config.example.php", "config.php"}


def p(msg=''):
    print(msg, flush=True)


def ensure_dir(ftp, remote_dir):
    try:
        ftp.mkd(remote_dir)
    except ftplib.error_perm:
        pass


def upload_file(ftp, local_path, remote_path):
    with open(local_path, 'rb') as f:
        ftp.storbinary(f"STOR {remote_path}", f)


def upload_dir(ftp, local_dir, remote_dir, skip_files=None):
    skip_files = skip_files or set()
    ensure_dir(ftp, remote_dir)
    uploaded = 0
    for entry in sorted(os.scandir(local_dir), key=lambda e: e.name):
        if entry.name in skip_files:
            continue
        remote_path = f"{remote_dir}/{entry.name}"
        if entry.is_dir():
            uploaded += upload_dir(ftp, entry.path, remote_path, skip_files)
        else:
            upload_file(ftp, entry.path, remote_path)
            uploaded += 1
            p(f"  {remote_path}")
    return uploaded


def remote_file_exists(ftp, remote_path):
    try:
        ftp.size(remote_path)
        return True
    except ftplib.error_perm:
        return False


# Vite builds with emptyOutDir:false (assets/ sits inside php-forpsi/public alongside api/,
# which emptyOutDir would wipe) — so old content-hashed JS/CSS never get removed locally on
# their own, and upload_dir() only ever adds/overwrites, never deletes. Without this, every
# stale local file (and every deploy that ever uploaded one) stays on the remote forever.
# frontend/scripts/clean-stale-assets.js prunes the local copy after every build; this mirrors
# that onto the remote so old deploys' leftovers actually go away too.
def prune_remote_assets(ftp, remote_dir, local_dir):
    local_files = set(os.listdir(local_dir))
    try:
        remote_entries = ftp.nlst(remote_dir)
    except ftplib.error_perm:
        return 0
    removed = 0
    for remote_path in remote_entries:
        name = remote_path.rsplit('/', 1)[-1]
        if name in ('.', '..') or name in local_files:
            continue
        try:
            ftp.delete(f"{remote_dir}/{name}")
            removed += 1
            p(f"  smazáno (zastaralé): {remote_dir}/{name}")
        except ftplib.error_perm:
            pass
    return removed


def main():
    if not os.path.isdir(LOCAL_PUBLIC):
        p(f"Chyba: {LOCAL_PUBLIC} neexistuje. Spusť nejdřív `npm run build` ve frontend/.")
        sys.exit(1)

    t0 = time.time()
    p(f"Připojuji se na {FTP_HOST}…")
    ftp = ftplib.FTP(FTP_HOST, timeout=30)
    ftp.login(FTP_USER, FTP_PASS)

    p(f"Nahrávám php-forpsi/public → {REMOTE_ROOT} …")
    count = upload_dir(ftp, LOCAL_PUBLIC, REMOTE_ROOT)
    prune_remote_assets(ftp, f"{REMOTE_ROOT}/assets", os.path.join(LOCAL_PUBLIC, 'assets'))

    p(f"Nahrávám php-forpsi/src → {REMOTE_ROOT}/src (bez config.php) …")
    count += upload_dir(ftp, LOCAL_SRC, f"{REMOTE_ROOT}/src", skip_files=SRC_SKIP_FILES)

    if not remote_file_exists(ftp, f"{REMOTE_ROOT}/src/config.php"):
        p(f"\nUPOZORNĚNÍ: {REMOTE_ROOT}/src/config.php na serveru neexistuje — appka nepojede,")
        p("dokud ho tam ručně nevytvoříš (zkopíruj config.example.php, doplň vlastní jwt_secret,")
        p("openai_api_key, anthropic_api_key a nastav 'seed_demo' => false).")

    p(f"Nahrávám data/.htaccess → {REMOTE_ROOT}/data/.htaccess …")
    ensure_dir(ftp, f"{REMOTE_ROOT}/data")
    upload_file(ftp, LOCAL_DATA_HTACCESS, f"{REMOTE_ROOT}/data/.htaccess")
    count += 1

    ftp.quit()
    p(f"\nHotovo — nahráno {count} souborů na muj.bloodandguts.cz za {time.time() - t0:.1f}s.")


if __name__ == '__main__':
    main()
