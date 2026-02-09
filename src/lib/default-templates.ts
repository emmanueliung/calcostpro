export const defaultTemplates = [
    {
        name: "T-shirt Standard",
        category: "Haut",
        description: "Col rond, manches courtes, jersey coton.",
        components: [
            { name: "Tissu Principal", type: "tissu", consumptionBase: 1.10, unit: "m" },
            { name: "Bord-côte col", type: "accessoire", consumptionBase: 0.05, unit: "m" },
            { name: "Bande de propreté", type: "accessoire", consumptionBase: 0.20, unit: "m" },
            { name: "Étiquette taille", type: "accessoire", consumptionBase: 1, unit: "u" }
        ],
        sizeConsumptions: [
            { size: "S", consumption: 0.75 },
            { size: "M", consumption: 0.90 },
            { size: "L", consumption: 1.20 },
            { size: "XL", consumption: 1.45 }
        ],
        totalLaborMinutes: 15
    },
    {
        name: "Polo Classique",
        category: "Haut",
        description: "Maille piquée, col tricoté, patte 2-3 boutons.",
        components: [
            { name: "Tissu Principal", type: "tissu", consumptionBase: 1.30, unit: "m" },
            { name: "Col tricoté", type: "accessoire", consumptionBase: 1, unit: "u" },
            { name: "Boutons", type: "accessoire", consumptionBase: 3, unit: "u" },
            { name: "Bord-côte manches", type: "accessoire", consumptionBase: 2, unit: "u" }
        ],
        sizeConsumptions: [
            { size: "S", consumption: 0.90 },
            { size: "M", consumption: 1.10 },
            { size: "L", consumption: 1.40 },
            { size: "XL", consumption: 1.70 }
        ],
        totalLaborMinutes: 30
    },
    {
        name: "Chemise Manches Longues",
        category: "Haut",
        description: "Coupe conventionnelle, poignets boutonnés.",
        components: [
            { name: "Tissu Principal", type: "tissu", consumptionBase: 1.80, unit: "m" },
            { name: "Boutons", type: "accessoire", consumptionBase: 9, unit: "u" },
            { name: "Thermocollant col/poignets", type: "accessoire", consumptionBase: 0.30, unit: "m" }
        ],
        sizeConsumptions: [
            { size: "S", consumption: 1.50 },
            { size: "M", consumption: 1.70 },
            { size: "L", consumption: 1.95 },
            { size: "XL", consumption: 2.20 }
        ],
        totalLaborMinutes: 50
    },
    {
        name: "Pantalon Chino / Jogging",
        category: "Bas",
        description: "Coupe droite, poches latérales.",
        components: [
            { name: "Tissu Principal", type: "tissu", consumptionBase: 1.50, unit: "m" },
            { name: "Fermeture éclair 20cm", type: "accessoire", consumptionBase: 1, unit: "u" },
            { name: "Bouton taille", type: "accessoire", consumptionBase: 1, unit: "u" },
            { name: "Doublure poches", type: "accessoire", consumptionBase: 0.25, unit: "m" }
        ],
        sizeConsumptions: [
            { size: "S", consumption: 1.20 },
            { size: "M", consumption: 1.40 },
            { size: "L", consumption: 1.65 },
            { size: "XL", consumption: 1.90 }
        ],
        totalLaborMinutes: 40
    },
    {
        name: "Veste Courte (Blouson)",
        category: "Veste",
        description: "Type bomber ou veste de travail courte.",
        components: [
            { name: "Tissu Principal", type: "tissu", consumptionBase: 2.00, unit: "m" },
            { name: "Fermeture éclair séparable", type: "accessoire", consumptionBase: 1, unit: "u" },
            { name: "Doublure corps", type: "accessoire", consumptionBase: 1.50, unit: "m" },
            { name: "Bord-côte poignets/taille", type: "accessoire", consumptionBase: 0.50, unit: "m" }
        ],
        sizeConsumptions: [
            { size: "S", consumption: 1.70 },
            { size: "M", consumption: 1.90 },
            { size: "L", consumption: 2.20 },
            { size: "XL", consumption: 2.50 }
        ],
        totalLaborMinutes: 75
    },
    {
        name: "Veste Mi-Longue (Parka/Manteau)",
        category: "Veste",
        description: "Coupe couvrant les hanches.",
        components: [
            { name: "Tissu Principal", type: "tissu", consumptionBase: 2.80, unit: "m" },
            { name: "Gros boutons", type: "accessoire", consumptionBase: 6, unit: "u" },
            { name: "Doublure intégrale", type: "accessoire", consumptionBase: 2.20, unit: "m" },
            { name: "Épaulettes", type: "accessoire", consumptionBase: 2, unit: "u" }
        ],
        sizeConsumptions: [
            { size: "S", consumption: 2.40 },
            { size: "M", consumption: 2.70 },
            { size: "L", consumption: 3.10 },
            { size: "XL", consumption: 3.50 }
        ],
        totalLaborMinutes: 120
    }
];
