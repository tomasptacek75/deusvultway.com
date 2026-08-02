"""
Gated deploy: build -> sync test DB z produkce -> nasazeni na test.bloodandguts.cz -> e2e sada
(Playwright) proti testu -> teprve pri uspechu nasazeni na produkci (bloodandguts.cz).

Proc tohle existuje: POC bezi na zive domene s realnymi (byt zatim vetsinou demo) klienty
trenera Davida. Rucni proklikani pred kazdym nasazenim neni realne (trener na to nema cas) a
omylem rozbita produkce je reputacni riziko pro Davidovy klienty i pro Toma (jeho klienti jsou
potencialne Davidovi klienti). Viz CLAUDE.md, sekce Deploy.

Pouziti:
    python deploy_gated.py                # build + DB sync + test deploy + e2e + (pri uspechu) prod deploy
    python deploy_gated.py --skip-build   # preskoci `npm run build` (build uz hotovy)
    python deploy_gated.py --skip-db-sync # preskoci sync testovaci DB z produkce (zachova aktualni test data)
    python deploy_gated.py --keep-going   # nasadi na produkci, i kdyz e2e selzou (nouzove pouziti)

Kroky:
    1. npm run build (frontend/)                -- stejny build jde na test i produkci
    2. python _sync_test_db_from_prod.py        -- prepise testovaci DB kopii produkcni (viz tam proc)
    3. python _ftp_deploy_test.py               -- nahraje na test.bloodandguts.cz
    4. npm test (e2e/)                          -- Playwright proti test.bloodandguts.cz
    5. jen pri uspechu kroku 4: python _ftp_deploy.py -- nahraje na bloodandguts.cz (produkce)

Kdyz e2e selzou, produkce se NENASADI -- zustava na predchozi (fungujici) verzi. Sestava, ktera
neprosla, zustava nahrana na testu k rucnimu overeni/oprave (viz test.bloodandguts.cz i
e2e/playwright-report/index.html pro detail selhani).

Predpoklada, ze `e2e/node_modules` uz existuje (jednorazovy setup, viz e2e/README.md):
    cd e2e && npm install && npx playwright install --with-deps chromium
"""
import argparse
import os
import shlex
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def p(msg=''):
    print(msg, flush=True)


def run(cmd, cwd=None):
    shown = ' '.join(shlex.quote(c) for c in cmd)
    p(f"$ {shown}" + (f"   (v {cwd})" if cwd else ''))
    return subprocess.run(cmd, cwd=cwd).returncode


def npm_cmd():
    # Na Windows se npm spousti jako npm.cmd -- prosty 'npm' pres subprocess bez shell=True
    # tam selze s FileNotFoundError.
    return 'npm.cmd' if os.name == 'nt' else 'npm'


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--skip-build', action='store_true', help='preskoci npm run build (build uz hotovy)')
    parser.add_argument('--skip-db-sync', action='store_true', help='preskoci sync testovaci DB z produkce (zachova aktualni test data)')
    parser.add_argument('--keep-going', action='store_true', help='nasadi na produkci, i kdyz e2e selzou (nouzove pouziti)')
    args = parser.parse_args()

    npm = npm_cmd()
    t0 = time.time()

    if not args.skip_build:
        p("== 1/5 Build frontendu ==")
        if run([npm, 'run', 'build'], cwd='frontend') != 0:
            p("\nBuild selhal -- deploy se nekona.")
            sys.exit(1)
    else:
        p("== 1/5 Build frontendu (preskoceno --skip-build) ==")

    if not args.skip_db_sync:
        p("\n== 2/5 Sync testovaci DB z produkce ==")
        if run([sys.executable, '_sync_test_db_from_prod.py']) != 0:
            p("\nSync DB selhal -- deploy se nekona.")
            sys.exit(1)
    else:
        p("\n== 2/5 Sync testovaci DB z produkce (preskoceno --skip-db-sync) ==")

    p("\n== 3/5 Nasazeni na test.bloodandguts.cz ==")
    if run([sys.executable, '_ftp_deploy_test.py']) != 0:
        p("\nNasazeni na test selhalo -- produkce se nedotkne.")
        sys.exit(1)

    if not os.path.isdir(os.path.join('e2e', 'node_modules')):
        p("\nChyba: e2e/node_modules neexistuje. Jednorazovy setup:")
        p("  cd e2e && npm install && npx playwright install --with-deps chromium")
        sys.exit(1)

    p("\n== 4/5 e2e testy proti test.bloodandguts.cz ==")
    # `npm test` (spousti 'playwright test' skrz package.json) na tomhle Windows setupu
    # nespolehlive resolvuje binarku playwright, kdyz se spousti pres subprocess.run z Pythonu
    # (funguje v interaktivnim shellu, ale ne takhle) -- primy zapis přes node cli.js obchazi
    # tenhle problem uplne a je to presne ten prikaz, kterym se testy v tomhle repu spolehlive
    # spoustely rucne po celou dobu vyvoje (viz historie commitu e2e/).
    e2e_rc = run(['node', 'node_modules/@playwright/test/cli.js', 'test'], cwd='e2e')
    if e2e_rc != 0:
        p(f"\ne2e testy selhaly (exit {e2e_rc}) -- HTML report: e2e/playwright-report/index.html")
        if not args.keep_going:
            p("Produkce se NENASADI. Oprav a spust znovu, nebo pouzij --keep-going pro nouzove nasazeni i tak.")
            sys.exit(1)
        p("--keep-going nastaveno, pokracuji na produkci navzdory selhani testu.")

    p("\n== 5/5 Nasazeni na produkci (bloodandguts.cz) ==")
    if run([sys.executable, '_ftp_deploy.py']) != 0:
        p("\nNasazeni na produkci selhalo.")
        sys.exit(1)

    p(f"\nHotovo za {time.time() - t0:.1f}s -- test.bloodandguts.cz i bloodandguts.cz bezi na stejne, e2e-overene sestave.")


if __name__ == '__main__':
    main()
