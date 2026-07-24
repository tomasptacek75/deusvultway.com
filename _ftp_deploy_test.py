"""
Nahraje BloodAndGuts na TEST subdoménu test.bloodandguts.cz přes FTP: frontend build + PHP api
(php-forpsi/public → /subdoms/test) a PHP zdrojový kód (php-forpsi/src → /subdoms/test/src,
chráněno .htaccess "Require all denied"). Stejný FTP účet jako produkce (Forpsi subdoména už
zřízená a DNS resolvuje), jen jiná vzdálená cesta — vzor viz ../Kamata.cz/_ftp_deploy_test.py.

Test má vlastní SQLite databázi (vznikne a naseeduje se sama při prvním requestu, stejně jako
produkční) — nikdy nesdílí data s /www.

Použití: nejdřív `npm run build` ve frontend/ (Vite builduje přímo do php-forpsi/public — stejný
build slouží produkci i testu, protože VITE_API_URL je relativní /api),
pak `python _ftp_deploy_test.py`.

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
REMOTE_ROOT = "/subdoms/test"

SRC_SKIP_FILES = {"config.example.php"}


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


def main():
    if not os.path.isdir(LOCAL_PUBLIC):
        p(f"Chyba: {LOCAL_PUBLIC} neexistuje. Spusť nejdřív `npm run build` ve frontend/.")
        sys.exit(1)
    if not os.path.isfile(os.path.join(LOCAL_SRC, 'config.php')):
        p(f"Chyba: {LOCAL_SRC}/config.php neexistuje (gitignored — zkopíruj z config.example.php).")
        sys.exit(1)

    t0 = time.time()
    p(f"Připojuji se na {FTP_HOST}…")
    ftp = ftplib.FTP(FTP_HOST, timeout=30)
    ftp.login(FTP_USER, FTP_PASS)

    p(f"Nahrávám php-forpsi/public → {REMOTE_ROOT} …")
    count = upload_dir(ftp, LOCAL_PUBLIC, REMOTE_ROOT)

    p(f"Nahrávám php-forpsi/src → {REMOTE_ROOT}/src …")
    count += upload_dir(ftp, LOCAL_SRC, f"{REMOTE_ROOT}/src", skip_files=SRC_SKIP_FILES)

    p(f"Nahrávám data/.htaccess → {REMOTE_ROOT}/data/.htaccess …")
    ensure_dir(ftp, f"{REMOTE_ROOT}/data")
    upload_file(ftp, LOCAL_DATA_HTACCESS, f"{REMOTE_ROOT}/data/.htaccess")
    count += 1

    ftp.quit()
    p(f"\nHotovo — nahráno {count} souborů na test.bloodandguts.cz za {time.time() - t0:.1f}s.")


if __name__ == '__main__':
    main()
