// Všechna testovací data vytvořená touto sadou nese prefix "E2E" a časovou značku — snadno se
// tak pozná v UI (kdyby úklid selhal) a běhy si navzájem nekolidují jmény.
export function uniqueName(prefix) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

// TimeSelect (frontend/src/components/TimeSelect.jsx) renderuje dva <select>: hodina, pak
// (jakmile je hodina vybraná) minuta. V daném kontejneru se poznají tím, že jsou to jediné
// <select> prvky ve formuláři na vytvoření/úpravu tréninku.
export async function fillTimeSelect(container, timeHHMM) {
  const [hour, minute] = timeHHMM.split(':')
  const selects = container.locator('select')
  await selects.nth(0).selectOption(hour)
  await selects.nth(1).selectOption(minute)
}
