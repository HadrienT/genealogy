import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { Person, Marriage } from "../types/person";
import { v4 as uuidv4 } from "uuid";

export interface TreeMeta {
  id: string;
  name: string;
  peopleCount: number;
}

interface FamilyContextType {
  // Tree management
  trees: TreeMeta[];
  currentTreeId: string | null;
  currentTreeName: string;
  switchTree: (id: string) => void;
  createTree: (name: string) => Promise<string>;
  deleteTree: (id: string) => Promise<void>;
  renameTree: (id: string, name: string) => Promise<void>;
  loadingTree: boolean;

  // People / data
  people: Person[];
  marriages: Marriage[];
  selectedPersonId: string | null;
  selectedPerson: Person | null;
  selectPerson: (id: string | null) => void;
  addPerson: (person: Omit<Person, "id">) => Person;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  removePerson: (id: string) => void;
  getPersonById: (id: string) => Person | undefined;
  updateMarriage: (partnerA: string, partnerB: string, updates: Partial<Omit<Marriage, 'partnerIds'>>) => void;
  mapFlyTarget: string | null;
  requestMapFlyTo: (id: string) => void;
  clearMapFlyTarget: () => void;
  editPersonId: string | null;
  requestEditPerson: (id: string) => void;
  clearEditPerson: () => void;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

const LAST_TREE_KEY = "genealogy-last-tree-id";

/**
 * API base URL.
 * - In dev: empty string → Vite proxy forwards /api to localhost:3001
 * - In prod: set VITE_API_URL to Cloud Run service URL
 */
const API_BASE = import.meta.env.VITE_API_URL || "";

/** Build Authorization headers from the stored JWT token */
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("genealogy-auth-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Reverse geocoding helpers ───────────────────────────────────────────────

/**
 * Reverse-geocode a single coordinate pair via Nominatim.
 * Returns structured address fields or null on failure.
 */
async function reverseGeocode(lat: number, lng: number) {
  await new Promise((r) => setTimeout(r, 1100)); // Nominatim usage policy: max 1 req/sec
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "fr,en" } });
  const data = await res.json();
  const addr = data.address;
  if (!addr) return null;

  const city = addr.city || addr.town || addr.village || addr.municipality;
  const countryCode: string | undefined = addr.country_code;
  const iso: string | undefined = addr["ISO3166-2-lvl6"];
  const deptCode =
    iso && countryCode === "fr" ? iso.replace(/^FR-/, "") : undefined;

  return {
    city: city || undefined,
    countryCode: countryCode || undefined,
    country: (addr.country as string) || undefined,
    postcode: (addr.postcode as string) || undefined,
    county: (addr.county as string) || undefined,
    deptCode: deptCode || undefined,
  };
}

/**
 * Reverse-geocode people who have birth/death coordinates but no city.
 * Populates structured address fields and persists the updated tree.
 */
async function backfillAddressFields(
  treeId: string,
  treeName: string,
  people: Person[],
  marriages: Marriage[]
) {
  const needBirthBackfill = people.filter(
    (p) => p.birthCoordinates && !p.birthCity
  );
  const needDeathBackfill = people.filter(
    (p) => p.deathCoordinates && !p.deathCity
  );
  if (needBirthBackfill.length === 0 && needDeathBackfill.length === 0) return;

  const updates = new Map<string, Partial<Person>>();

  // Backfill birth address fields
  for (const person of needBirthBackfill) {
    try {
      const result = await reverseGeocode(
        person.birthCoordinates!.lat,
        person.birthCoordinates!.lng
      );
      if (result) {
        updates.set(person.id, {
          ...(updates.get(person.id) ?? {}),
          birthCity: result.city,
          birthCountryCode: result.countryCode,
          birthCountry: result.country,
          birthPostcode: result.postcode,
          birthCounty: result.county,
          birthDeptCode: result.deptCode,
        });
      }
    } catch (err) {
      console.warn(`Reverse geocode (birth) failed for ${person.firstName}:`, err);
    }
  }

  // Backfill death address fields
  for (const person of needDeathBackfill) {
    try {
      const result = await reverseGeocode(
        person.deathCoordinates!.lat,
        person.deathCoordinates!.lng
      );
      if (result) {
        updates.set(person.id, {
          ...(updates.get(person.id) ?? {}),
          deathCity: result.city,
          deathCountryCode: result.countryCode,
          deathCountry: result.country,
          deathPostcode: result.postcode,
          deathCounty: result.county,
          deathDeptCode: result.deptCode,
        });
      }
    } catch (err) {
      console.warn(`Reverse geocode (death) failed for ${person.firstName}:`, err);
    }
  }

  if (updates.size === 0) return;

  const updatedPeople = people.map((p) => {
    const u = updates.get(p.id);
    return u ? { ...p, ...u } : p;
  });

  // Persist to API and update UI state
  persistTree(treeId, treeName, updatedPeople, marriages);

  // Dispatch event so provider updates its state
  window.dispatchEvent(
    new CustomEvent("backfill-complete", { detail: updatedPeople })
  );
}

/** Save tree data to the API */
async function persistTree(treeId: string, name: string, people: Person[], marriages: Marriage[]) {
  try {
    await fetch(`${API_BASE}/api/trees/${treeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name, people, marriages }),
    });
  } catch (err) {
    console.warn("Could not save to server:", err);
  }
}

export const FamilyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [trees, setTrees] = useState<TreeMeta[]>([]);
  const [currentTreeId, setCurrentTreeId] = useState<string | null>(null);
  const [currentTreeName, setCurrentTreeName] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [marriages, setMarriages] = useState<Marriage[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [mapFlyTarget, setMapFlyTarget] = useState<string | null>(null);
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);

  // Refs for async persist
  const marriagesRef = useRef(marriages);
  useEffect(() => { marriagesRef.current = marriages; }, [marriages]);
  const peopleRef = useRef(people);
  useEffect(() => { peopleRef.current = people; }, [people]);
  const treeNameRef = useRef(currentTreeName);
  useEffect(() => { treeNameRef.current = currentTreeName; }, [currentTreeName]);
  const currentTreeIdRef = useRef(currentTreeId);
  useEffect(() => { currentTreeIdRef.current = currentTreeId; }, [currentTreeId]);

  // Listen for backfill-complete events (address field reverse geocoding)
  useEffect(() => {
    const handler = (e: Event) => {
      const updatedPeople = (e as CustomEvent).detail as Person[];
      setPeople(updatedPeople);
    };
    window.addEventListener("backfill-complete", handler);
    return () => window.removeEventListener("backfill-complete", handler);
  }, []);

  /** Fetch the list of trees from the API */
  const refreshTreeList = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/trees`, {
        headers: { ...authHeaders() },
      });
      const list: TreeMeta[] = await res.json();
      setTrees(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  /** Load a specific tree's data from the API */
  const loadTree = useCallback(async (id: string) => {
    setLoadingTree(true);
    try {
      const res = await fetch(`${API_BASE}/api/trees/${id}`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error("Tree not found");
      const data = await res.json();
      const loadedPeople: Person[] = data.people || [];
      const loadedMarriages: Marriage[] = data.marriages || [];
      setPeople(loadedPeople);
      setMarriages(loadedMarriages);
      setCurrentTreeId(id);
      setCurrentTreeName(data.name || "Untitled");
      setSelectedPersonId(null);
      localStorage.setItem(LAST_TREE_KEY, id);

      // Backfill structured address fields via reverse geocoding
      backfillAddressFields(id, data.name || "Untitled", loadedPeople, loadedMarriages);
    } catch {
      console.warn(`Failed to load tree ${id}`);
    } finally {
      setLoadingTree(false);
    }
  }, []);

  // On mount: fetch tree list, then load last-used tree (or first available)
  useEffect(() => {
    (async () => {
      const list = await refreshTreeList();
      if (list.length === 0) {
        setLoadingTree(false);
        return;
      }
      const lastId = localStorage.getItem(LAST_TREE_KEY);
      const target = list.find((t) => t.id === lastId) ? lastId! : list[0].id;
      await loadTree(target);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTree = useCallback(
    (id: string) => { loadTree(id); },
    [loadTree]
  );

  const createTree = useCallback(
    async (name: string): Promise<string> => {
      const res = await fetch(`${API_BASE}/api/trees`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name }),
      });
      const tree = await res.json();
      await refreshTreeList();
      await loadTree(tree.id);
      return tree.id;
    },
    [refreshTreeList, loadTree]
  );

  const deleteTree = useCallback(
    async (id: string) => {
      await fetch(`${API_BASE}/api/trees/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      const list = await refreshTreeList();
      if (id === currentTreeIdRef.current) {
        if (list.length > 0) {
          await loadTree(list[0].id);
        } else {
          setPeople([]);
          setMarriages([]);
          setCurrentTreeId(null);
          setCurrentTreeName("");
        }
      }
    },
    [refreshTreeList, loadTree]
  );

  const renameTree = useCallback(
    async (id: string, name: string) => {
      await fetch(`${API_BASE}/api/trees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name }),
      });
      if (id === currentTreeIdRef.current) {
        setCurrentTreeName(name);
      }
      await refreshTreeList();
    },
    [refreshTreeList]
  );

  const persist = useCallback(
    (nextPeople: Person[], nextMarriages?: Marriage[]) => {
      setPeople(nextPeople);
      peopleRef.current = nextPeople;           // sync ref immediately
      if (nextMarriages !== undefined) {
        setMarriages(nextMarriages);
        marriagesRef.current = nextMarriages;   // sync ref immediately
      }
      const id = currentTreeIdRef.current;
      if (!id) return;
      persistTree(
        id,
        treeNameRef.current,
        nextPeople,
        nextMarriages ?? marriagesRef.current
      );
      // Update tree list people count
      setTrees((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, peopleCount: nextPeople.length } : t
        )
      );
    },
    []
  );

  const selectPerson = useCallback((id: string | null) => {
    setSelectedPersonId(id);
  }, []);

  const requestMapFlyTo = useCallback((id: string) => {
    setMapFlyTarget(id);
  }, []);

  const clearMapFlyTarget = useCallback(() => {
    setMapFlyTarget(null);
  }, []);

  const requestEditPerson = useCallback((id: string) => {
    setEditPersonId(id);
  }, []);

  const clearEditPerson = useCallback(() => {
    setEditPersonId(null);
  }, []);

  const getPersonById = useCallback(
    (id: string) => people.find((p) => p.id === id),
    [people]
  );

  const selectedPerson = selectedPersonId
    ? people.find((p) => p.id === selectedPersonId) ?? null
    : null;

  const addPerson = useCallback(
    (person: Omit<Person, "id">): Person => {
      const newPerson: Person = { ...person, id: uuidv4() };
      const next = [...people, newPerson];

      // Wire up parent↔child relationships
      if (newPerson.parentIds) {
        newPerson.parentIds.forEach((parentId) => {
          const idx = next.findIndex((p) => p.id === parentId);
          if (idx !== -1) {
            const parent = next[idx];
            next[idx] = {
              ...parent,
              childrenIds: [...(parent.childrenIds ?? []), newPerson.id],
            };
          }
        });
      }

      // Wire up child→parent relationships (new person is a parent)
      if (newPerson.childrenIds) {
        newPerson.childrenIds.forEach((childId) => {
          const idx = next.findIndex((p) => p.id === childId);
          if (idx !== -1) {
            const child = next[idx];
            if (!child.parentIds?.includes(newPerson.id)) {
              next[idx] = {
                ...child,
                parentIds: [...(child.parentIds ?? []), newPerson.id],
              };
            }
          }
        });
      }

      // Wire up partner relationships bidirectionally
      if (newPerson.partnerIds) {
        newPerson.partnerIds.forEach((partnerId) => {
          const idx = next.findIndex((p) => p.id === partnerId);
          if (idx !== -1) {
            const partner = next[idx];
            if (!partner.partnerIds?.includes(newPerson.id)) {
              next[idx] = {
                ...partner,
                partnerIds: [...(partner.partnerIds ?? []), newPerson.id],
              };
            }
          }
        });
      }

      persist(next);
      return newPerson;
    },
    [people, persist]
  );

  const updatePerson = useCallback(
    (id: string, updates: Partial<Person>) => {
      const next = people.map((p) => (p.id === id ? { ...p, ...updates } : p));
      persist(next);
    },
    [people, persist]
  );

  const updateMarriage = useCallback(
    (partnerA: string, partnerB: string, updates: Partial<Omit<Marriage, 'partnerIds'>>) => {
      const idx = marriages.findIndex(
        (m) => m.partnerIds.includes(partnerA) && m.partnerIds.includes(partnerB)
      );
      let nextMarriages: Marriage[];
      if (idx >= 0) {
        nextMarriages = marriages.map((m, i) =>
          i === idx ? { ...m, ...updates } : m
        );
      } else {
        // Create a new marriage record
        nextMarriages = [
          ...marriages,
          { partnerIds: [partnerA, partnerB] as [string, string], ...updates },
        ];
      }
      setMarriages(nextMarriages);
      persist(peopleRef.current, nextMarriages);
    },
    [marriages, persist]
  );

  const removePerson = useCallback(
    (id: string) => {
      let next = people.filter((p) => p.id !== id);

      // Clean up references in other people
      next = next.map((p) => ({
        ...p,
        parentIds: p.parentIds?.filter((pid) => pid !== id),
        partnerIds: p.partnerIds?.filter((pid) => pid !== id),
        childrenIds: p.childrenIds?.filter((cid) => cid !== id),
      }));

      // Remove marriages involving this person
      const nextMarriages = marriages.filter(
        (m) => !m.partnerIds.includes(id)
      );

      persist(next, nextMarriages);
      if (selectedPersonId === id) setSelectedPersonId(null);
    },
    [people, marriages, persist, selectedPersonId]
  );

  return (
    <FamilyContext.Provider
      value={{
        trees,
        currentTreeId,
        currentTreeName,
        switchTree,
        createTree,
        deleteTree,
        renameTree,
        loadingTree,
        people,
        marriages,
        selectedPersonId,
        selectedPerson,
        selectPerson,
        addPerson,
        updatePerson,
        removePerson,
        getPersonById,
        updateMarriage,
        mapFlyTarget,
        requestMapFlyTo,
        clearMapFlyTarget,
        editPersonId,
        requestEditPerson,
        clearEditPerson,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
};

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within FamilyProvider");
  return ctx;
}
