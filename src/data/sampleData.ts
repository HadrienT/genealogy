import type { FamilyData } from "../types/person";

/**
 * Sample data – a small fictional family spanning 4 generations.
 * Replace / extend with your own data!
 */
export const sampleData: FamilyData = {
  people: [
    // ── Generation 1 (great-grandparents) ───────
    {
      id: "ggf-1",
      firstName: "Auguste",
      lastName: "Tramoni",
      gender: "male",
      birthDate: "1880",
      deathDate: "1945",
      birthPlace: "Ajaccio, Corse",
      birthCoordinates: { lat: 41.9263, lng: 8.7369 },
      partnerIds: ["ggm-1"],
      childrenIds: ["gf-1"],
      occupation: "Pêcheur",
    },
    {
      id: "ggm-1",
      firstName: "Marie",
      lastName: "Ferracci",
      maidenName: "Ferracci",
      gender: "female",
      birthDate: "1885",
      deathDate: "1960",
      birthPlace: "Bastia, Corse",
      birthCoordinates: { lat: 42.6975, lng: 9.4529 },
      partnerIds: ["ggf-1"],
      childrenIds: ["gf-1"],
    },

    // ── Generation 2 (grandparents) ─────────────
    {
      id: "gf-1",
      firstName: "Jean",
      lastName: "Tramoni",
      gender: "male",
      birthDate: "1920-06-12",
      deathDate: "1998-01-03",
      birthPlace: "Marseille, France",
      birthCoordinates: { lat: 43.2965, lng: 5.3698 },
      parentIds: ["ggf-1", "ggm-1"],
      partnerIds: ["gm-1"],
      childrenIds: ["f-1"],
      occupation: "Menuisier",
    },
    {
      id: "gm-1",
      firstName: "Antoinette",
      lastName: "Tramoni",
      maidenName: "Luciani",
      gender: "female",
      birthDate: "1925",
      deathDate: "2005",
      birthPlace: "Lyon, France",
      birthCoordinates: { lat: 45.764, lng: 4.8357 },
      partnerIds: ["gf-1"],
      childrenIds: ["f-1"],
    },

    // ── Generation 3 (parents) ──────────────────
    {
      id: "f-1",
      firstName: "Pierre",
      lastName: "Tramoni",
      gender: "male",
      birthDate: "1955-09-20",
      birthPlace: "Paris, France",
      birthCoordinates: { lat: 48.8566, lng: 2.3522 },
      parentIds: ["gf-1", "gm-1"],
      partnerIds: ["m-1"],
      childrenIds: ["me", "s-1"],
      occupation: "Ingénieur",
    },
    {
      id: "m-1",
      firstName: "Catherine",
      lastName: "Tramoni",
      maidenName: "Dupont",
      gender: "female",
      birthDate: "1958-03-14",
      birthPlace: "Bordeaux, France",
      birthCoordinates: { lat: 44.8378, lng: -0.5792 },
      partnerIds: ["f-1"],
      childrenIds: ["me", "s-1"],
      occupation: "Professeur",
    },

    // ── Generation 4 (current) ──────────────────
    {
      id: "me",
      firstName: "Hadrien",
      lastName: "Tramoni",
      gender: "male",
      birthDate: "1990-07-22",
      birthPlace: "Toulouse, France",
      birthCoordinates: { lat: 43.6047, lng: 1.4442 },
      parentIds: ["f-1", "m-1"],
      notes: "That's me!",
    },
    {
      id: "s-1",
      firstName: "Sophie",
      lastName: "Tramoni",
      gender: "female",
      birthDate: "1993-11-05",
      birthPlace: "Toulouse, France",
      birthCoordinates: { lat: 43.6047, lng: 1.4442 },
      parentIds: ["f-1", "m-1"],
      occupation: "Médecin",
    },
  ],
  marriages: [
    {
      partnerIds: ["ggf-1", "ggm-1"],
      date: "1905",
      place: "Ajaccio, Corse",
    },
    {
      partnerIds: ["gf-1", "gm-1"],
      date: "1948-06-20",
      place: "Marseille",
    },
    {
      partnerIds: ["f-1", "m-1"],
      date: "1982-09-12",
      place: "Paris",
    },
  ],
};
