export type SeedIngredient = [name: string, quantity: number | null, unit: string];
export type SeedDish = {
  name: string;
  description: string;
  cookMinutes: number | null;
  ingredients: SeedIngredient[];
};

type Recipe = { name: string; description: string; ingredients: SeedIngredient[] };

const RECIPES: Recipe[] = [
  {
    name: "Mămăligă de casă",
    description:
      "Se fierbe mălaiul în apă până la consistența dorită. Randament final: ≈660 g (randament teoretic; rețeta standard folosită în jurnal). ≈88 kcal/100 g.",
    ingredients: [
      ["Apă", 500, "g"],
      ["Mălai", 160, "g"],
    ],
  },
  {
    name: "Piure de cartofi",
    description: "Cartofii se fierb, apoi se pasează cu untul și laptele. Randament final: ≈333 g. ≈83 kcal/100 g.",
    ingredients: [
      ["Cartofi", 248, "g"],
      ["Unt", 5, "g"],
      ["Lapte", 80, "g"],
    ],
  },
  {
    name: "Salată de vinete",
    description:
      "Vinetele coapte și bine scurse se toacă. Se amestecă cu ceapa, sarea și uleiul. Randament final: ≈964 g (estimare din ingredientele amestecate). ≈141 kcal/100 g.",
    ingredients: [
      ["Vinete coapte, bine scurse", 748, "g"],
      ["Ulei de floarea-soarelui", 130, "ml"],
      ["Ceapă", 90, "g"],
      ["Sare", 6, "g"],
    ],
  },
  {
    name: "Ciorbă de perișoare de pui",
    description:
      "Se formează perișoarele din carne, ceapă, ou și sare. Legumele se fierb în ciorbă, se adaugă perișoarele, roșiile și borșul. La final se adaugă oul bătut și leușteanul. Randament raportat: 22 perișoare. Randament final: 3.780 g. ≈26 kcal/100 g.",
    ingredients: [
      ["Carne de pui (pentru perișoare)", 500, "g"],
      ["Ceapă (pentru perișoare)", 85, "g"],
      ["Ou (pentru perișoare)", 1, "buc"],
      ["Sare (pentru perișoare)", 9, "g"],
      ["Ceapă (pentru ciorbă)", 72, "g"],
      ["Țelină rădăcină", 49, "g"],
      ["Pătrunjel rădăcină", 81, "g"],
      ["Morcov", 64, "g"],
      ["Roșii", 420, "g"],
      ["Borș", 100, "ml"],
      ["Sare (pentru ciorbă)", 18, "g"],
      ["Leuștean", 23, "g"],
      ["Ou bătut", 1, "buc"],
    ],
  },
  {
    name: "Mâncare de spanac cu pui",
    description:
      "Ceapa și usturoiul se gătesc cu uleiul. Se adaugă puiul și spanacul. Amidonul se folosește pentru legarea sosului, apoi se adaugă apa și sarea după nevoie. Randament final: 1.900 g. ≈103 kcal/100 g.",
    ingredients: [
      ["Spanac congelat (26 kcal/100 g)", 900, "g"],
      ["Carne de pui", 728, "g"],
      ["Ceapă albă", 100, "g"],
      ["Usturoi", 27, "g"],
      ["Amidon de porumb (351 kcal/100 g)", 30, "g"],
      ["Ulei de floarea-soarelui", 76, "g"],
      ["Sare", 15, "g"],
      ["Apă", 300, "g"],
    ],
  },
  {
    name: "Mâncare de mazăre cu pui",
    description:
      "Ceapa se gătește cu uleiul. Se adaugă carnea, mazărea, pasta de tomate și apa. La final se adaugă pătrunjelul verde. Randament final: 2.980 g net. ≈98 kcal/100 g.",
    ingredients: [
      ["Mazăre (74 kcal/100 g)", 900, "g"],
      ["Carne de pui", 1451, "g"],
      ["Ceapă", 115, "g"],
      ["Ulei (≈46 g)", 50, "ml"],
      ["Pastă de tomate (88 kcal/100 g)", 61, "g"],
      ["Pătrunjel verde", 26, "g"],
      ["Apă", 800, "g"],
    ],
  },
  {
    name: "Ciorbă de vită",
    description:
      "Carnea de gât se fierbe separat. Legumele se fierb în zeama de carne. Se adaugă roșiile pasate și borșul. Carnea se păstrează în preparat / se porționează împreună cu ciorba. Randament final: 5.444 g. ≈61 kcal/100 g.",
    ingredients: [
      ["Carne de vită – gât, fiartă", 1455, "g"],
      ["Morcov", 109, "g"],
      ["Păstârnac", 103, "g"],
      ["Pătrunjel rădăcină", 87, "g"],
      ["Țelină rădăcină", 154, "g"],
      ["Ardei kapia roșu", 183, "g"],
      ["Roșii pasate de casă (roșii blenduite și sterilizate)", 642, "g"],
      ["Borș", 150, "g"],
      ["Zeama în care a fiert carnea (completare până la randamentul final)", null, ""],
    ],
  },
  {
    name: "Ciorbă de curcan",
    description:
      "Carnea se fierbe și se curăță de piele și os. Legumele se fierb în apa de carne. Se adaugă roșiile pasate și borșul. La final se adaugă oul și leușteanul. Randament final: 2.785 g. ≈39 kcal/100 g.",
    ingredients: [
      ["Carne de pe aripi de curcan, fiartă, fără os și piele", 440, "g"],
      ["Morcov", 60, "g"],
      ["Ardei gras verde", 124, "g"],
      ["Țelină rădăcină", 43, "g"],
      ["Pătrunjel rădăcină", 43, "g"],
      ["Păstârnac", 70, "g"],
      ["Zucchini", 113, "g"],
      ["Roșii pasate de casă", 450, "g"],
      ["Apa în care a fiert carnea", 1640, "g"],
      ["Borș", 90, "g"],
      ["Ou", 1, "buc"],
      ["Leuștean verde (cantitate neprecizată)", null, ""],
    ],
  },
  {
    name: "Broccoli cu ulei de măsline",
    description:
      "Broccoli se gătește în tigaie cu uleiul de măsline până la textura dorită. Randament final: 373 g. ≈108 kcal/100 g.",
    ingredients: [
      ["Broccoli", 400, "g"],
      ["Ulei de măsline", 30, "g"],
    ],
  },
  {
    name: "Wrap cu pui, avocado și iaurt",
    description:
      "Ingredientele se distribuie uniform pe lipie, se adaugă sosul de iaurt cu condimente și se rulează. Randament final: 430 g. ≈142 kcal/100 g.",
    ingredients: [
      ["Lipie integrală", 60, "g"],
      ["Avocado", 67, "g"],
      ["Brânză de vaci Pilos 4,2%", 33, "g"],
      ["Castravete", 50, "g"],
      ["Iaurt grecesc Pilos 2%", 120, "g"],
      ["Pulpă de pui la grill, fără piele", 100, "g"],
      ["Usturoi granulat, busuioc, oregano (după gust)", null, ""],
    ],
  },
  {
    name: "Frozen yogurt simplu",
    description:
      "Se amestecă iaurtul cu laptele și aromele, apoi se congelează / procesează în aparatul de înghețată. Randament final: ≈428 g înainte de congelare. ≈61 kcal/100 g.",
    ingredients: [
      ["Iaurt 3,5%", 268, "g"],
      ["Lapte 3,5%", 160, "ml"],
      ["Flavour drops (aport caloric neglijabil / conform etichetei)", null, ""],
    ],
  },
  {
    name: "Ardei umpluți",
    description: "26 bucăți.",
    ingredients: [
      ["Ceapă", 136, "g"],
      ["Carne tocată de porc Kaufland «Vreau din România» (273 kcal/100 g)", 2000, "g"],
      ["Orez", 60, "g"],
      ["Pastă de tomate Sultan 25%", 216, "g"],
      ["Pătrunjel verde", 46, "g"],
      ["Ardei gras verde rotund (26 bucăți)", 1183, "g"],
      ["Roșii pasate", 656, "g"],
      ["Ulei de floarea-soarelui (inițial; 199 g ulei + sucuri recuperat)", 200, "g"],
    ],
  },
  {
    name: "Chili con carne",
    description: "Randament final recuperat: 1.547 g.",
    ingredients: [
      ["Ulei", 50, "g"],
      ["Ceapă roșie", 58, "g"],
      ["Ceapă", 85, "g"],
      ["Ardei", 256, "g"],
      ["Vită 10%", 800, "g"],
      ["Fasole roșie, nedrenată", 1, "conservă"],
      ["Roșii cuburi, nedrenate", 1, "conservă"],
      ["Condimente", null, ""],
    ],
  },
  {
    name: "Pizza de casă",
    description: "Randament copt recuperat: 757 g.",
    ingredients: [
      ["Aluat", 550, "g"],
      ["Șuncă", 2, "pachete"],
      ["Brânză", 100, "g"],
      ["Sos de roșii", null, ""],
    ],
  },
  {
    name: "Supă de pasăre cu găluște – varianta august",
    description: "Oala finală ≈2.892 g. 7 găluști. ≈60–61 kcal/100 g. ≈49 kcal/gălușcă.",
    ingredients: [],
  },
  {
    name: "Supă cu găluște – varianta septembrie",
    description: "8 găluști. Fără ulei.",
    ingredients: [
      ["Piept de pui", 966, "g"],
      ["Păstârnac", 64, "g"],
      ["Pătrunjel rădăcină", 63, "g"],
      ["Morcov", 68, "g"],
      ["Ardei", 90, "g"],
      ["Zucchini", 175, "g"],
      ["Ou", 1, "buc"],
      ["Griș (8 găluști)", 70, "g"],
    ],
  },
];

export const FAMILY_RECIPES: SeedDish[] = RECIPES.map((recipe) => ({ ...recipe, cookMinutes: null }));
