
export const defaultMaterialsData = {
  "fabrics": [
    { "id": "fab-1", "name": "Algodón Jersey", "price": 1, "unit": "m" },
    { "id": "fab-2", "name": "Algodón Piqué", "price": 1, "unit": "m" },
    { "id": "fab-3", "name": "Algodón Frizado (o Franela)", "price": 1, "unit": "m" },
    { "id": "fab-4", "name": "Algodón Frizado Sintético", "price": 1, "unit": "m" },
    { "id": "fab-5", "name": "Kaki Algodón", "price": 1, "unit": "m" },
    { "id": "fab-6", "name": "Algodón Fulldicra", "price": 1, "unit": "m" },
    { "id": "fab-7", "name": "Dri-FIT", "price": 1, "unit": "m" },
    { "id": "fab-8", "name": "Poliadidas (Poliamida/Nylon)", "price": 1, "unit": "m" },
    { "id": "fab-9", "name": "Polibrillo", "price": 1, "unit": "m" },
    { "id": "fab-10", "name": "Vanisado", "price": 1, "unit": "m" },
    { "id": "fab-11", "name": "Impala", "price": 1, "unit": "m" },
    { "id": "fab-12", "name": "Tafetán", "price": 1, "unit": "m" },
    { "id": "fab-13", "name": "Taslan", "price": 1, "unit": "m" },
    { "id": "fab-14", "name": "Fibra", "price": 1, "unit": "m" },
    { "id": "fab-15", "name": "Jean (o Denim)", "price": 1, "unit": "m" },
    { "id": "fab-16", "name": "Kaki Drill", "price": 1, "unit": "m" },
    { "id": "fab-17", "name": "Lycra Dicra (o Kaki Lycra)", "price": 1, "unit": "m" },
    { "id": "fab-18", "name": "Polav (o Tela Polar)", "price": 1, "unit": "m" },
    { "id": "fab-19", "name": "Prada", "price": 1, "unit": "m" },
    { "id": "fab-20", "name": "Popelina", "price": 1, "unit": "m" },
    { "id": "fab-21", "name": "Jaipura", "price": 1, "unit": "m" },
    { "id": "fab-22", "name": "Denim", "price": 1, "unit": "m" },
    { "id": "fab-23", "name": "Lino", "price": 1, "unit": "m" }
  ],
  "accessories": [
    { "id": "acc-1", "name": "Cierre", "price": 1, "unit": "piece" },
    { "id": "acc-2", "name": "Botón", "price": 1, "unit": "piece" },
    { "id": "acc-3", "name": "Cordón de Algodón", "price": 1.5, "unit": "m" },
    { "id": "acc-4", "name": "Elástico", "price": 1, "unit": "piece" },
    { "id": "acc-5", "name": "Ojales", "price": 1, "unit": "piece" },
    { "id": "acc-6", "name": "Forros", "price": 1, "unit": "piece" },
    { "id": "acc-7", "name": "Elástico", "price": 1, "unit": "m" },
    { "id": "acc-8", "name": "Cierre Metálico", "price": 1, "unit": "piece" },
    { "id": "acc-9", "name": "Botón a Presión", "price": 1, "unit": "piece" }
  ],
  "prints": [
    { "id": "prt-1", "name": "Serigrafía", "price": 1, "unit": "fixed" },
    { "id": "prt-2", "name": "Bordado", "price": 1, "unit": "fixed" },
    { "id": "prt-3", "name": "DTF", "price": 1, "unit": "fixed" },
    { "id": "prt-4", "name": "Sublimación", "price": 1, "unit": "fixed" }
  ]
} as const;

/**
 * Returns a deep, mutable copy of the default materials data.
 * This is crucial to avoid issues with readonly types when assigning to state.
 */
export function getDefaultMaterials() {
  return JSON.parse(JSON.stringify(defaultMaterialsData));
}
