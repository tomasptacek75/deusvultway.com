// Český 5. pád (oslovení) se nedá spolehlivě odvodit pravidlem bez plnohodnotného
// morfologického analyzátoru — proto ruční tabulka jmen, která v appce reálně existují
// (trenér + seedovaní demo klienti). Jméno mimo tabulku (budoucí reálný klient) zůstane
// beze změny — lepší nesklonit, než sklonit špatně.
const VOCATIVE = {
  David: 'Davide',
  Petr: 'Petře',
  Jana: 'Jano',
  Tomáš: 'Tomáši',
  Lucie: 'Lucie',
  Martin: 'Martine',
  Eva: 'Evo',
  Jakub: 'Jakube',
  Tereza: 'Terezo',
  Filip: 'Filipe',
  Kateřina: 'Kateřino',
  Ondřej: 'Ondřeji',
  Barbora: 'Barboro',
  Michal: 'Michale',
  Petra: 'Petro',
  Jan: 'Jane',
  Veronika: 'Veroniko',
  Adéla: 'Adélo',
  Lukáš: 'Lukáši',
  Nikola: 'Nikolo',
  Radek: 'Radku',
  Simona: 'Simono',
  Zuzana: 'Zuzano',
}

export function vocative(firstName) {
  return VOCATIVE[firstName] ?? firstName
}
