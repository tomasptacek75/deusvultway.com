"""
Přepíše databázi na test.deusvultway.com aktuální kopií produkční databáze.

Proč tohle existuje: dokud appka nemá reálné portálové klienty a nezačalo se "opravdu"
testovat s nimi, nemá smysl, aby test měl vlastní, dlouhodobě se rozjíždějící sadu dat —
opakované běhy e2e sady na testu vytvářely testovací záznamy (klienty, posilovny, sekce
knihovny, poptávky), které appka neuměla nikde smazat, takže se na testu hromadily celé dny
(viz CLAUDE.md, "Automated e2e test gate"). Místo aby appka uměla mazat všechno možné, je
jednodušší tenhle rozjezd pravidelně srovnat nazpátek na produkční data — na žádost uživatele
2026-08-02: "Chci aby test byl to samé co produkce dokud tam nebudou klienti a nezačneme
reálně testovat."

Nikdy neběží automaticky mimo `deploy_gated.py` (viz tam) a nikdy nezapisuje do produkce —
jen čte /www/data/bloodandguts.db a přepisuje /subdoms/test/data/bloodandguts.db.

Použití: python _sync_test_db_from_prod.py
"""
import ftplib
import io
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from _ftp_credentials import FTP_HOST, FTP_USER, FTP_PASS

PROD_DB = "/www/data/bloodandguts.db"
TEST_DB = "/subdoms/test/data/bloodandguts.db"


def p(msg=''):
    print(msg, flush=True)


def ensure_dir(ftp, remote_dir):
    try:
        ftp.mkd(remote_dir)
    except ftplib.error_perm:
        pass


def main():
    t0 = time.time()
    p(f"Připojuji se na {FTP_HOST}…")
    ftp = ftplib.FTP(FTP_HOST, timeout=60)
    ftp.login(FTP_USER, FTP_PASS)

    p(f"Stahuji produkční databázi {PROD_DB} …")
    buf = io.BytesIO()
    ftp.retrbinary(f"RETR {PROD_DB}", buf.write)
    size = buf.tell()
    if size == 0:
        p("Chyba: stažená databáze má 0 bajtů, přeruším bez zápisu na test.")
        sys.exit(1)
    p(f"  staženo {size:,} bajtů")

    p(f"Nahrávám jako testovací databázi {TEST_DB} …")
    # Na čerstvě zřízené subdoméně (žádný _ftp_deploy_test.py tam ještě neběžel) data/ adresář
    # ještě neexistuje — bez tohohle STOR spadne na "553 Can't open that file".
    ensure_dir(ftp, TEST_DB.rsplit('/', 1)[0])
    buf.seek(0)
    ftp.storbinary(f"STOR {TEST_DB}", buf)

    ftp.quit()
    p(f"\nHotovo za {time.time() - t0:.1f}s — test.deusvultway.com teď běží na kopii produkčních dat.")


if __name__ == '__main__':
    main()
