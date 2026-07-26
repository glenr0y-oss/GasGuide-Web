// Real vehicle data lookups for "+ Add a vehicle", replacing the alert()
// placeholder. Two free, keyless APIs, each doing the job CLAUDE.md assigns
// it:
//   - NHTSA vPIC decodes a VIN into year/make/model/fuel type.
//     https://vpic.nhtsa.dot.gov/api/
//   - fueleconomy.gov supplies the EPA combined MPG (or mi/kWh for an EV)
//     for that vehicle, matched best-effort against the decoded identity.
//     https://www.fueleconomy.gov/ws/rest/

const VPIC_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const FE_BASE = 'https://www.fueleconomy.gov/ws/rest/vehicle';

function titleCase(str) {
  return str.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

/**
 * @param {string} vin
 * @returns {Promise<{make: string, model: string, year: number, fuelType: string, isEvGuess: boolean, cylinders: number|null, displacementL: number|null}>}
 */
export async function decodeVin(vin) {
  const res = await fetch(`${VPIC_BASE}/decodevinvalues/${encodeURIComponent(vin.trim())}?format=json`);
  if (!res.ok) throw new Error('VIN lookup failed — try again in a moment.');
  const data = await res.json();
  const result = data.Results?.[0];
  const year = parseInt(result?.ModelYear, 10);
  if (!result?.Make || !result?.Model || !year) {
    throw new Error("Couldn't decode that VIN — double-check it and try again.");
  }
  return {
    make: titleCase(result.Make),
    model: titleCase(result.Model),
    year,
    fuelType: result.FuelTypePrimary || 'Gasoline',
    isEvGuess: /electric/i.test(result.FuelTypePrimary || ''),
    cylinders: result.EngineCylinders ? parseInt(result.EngineCylinders, 10) : null,
    displacementL: result.DisplacementL ? parseFloat(result.DisplacementL) : null,
  };
}

async function fetchMenu(path, params) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${FE_BASE}/menu/${path}?${query}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data?.menuItem) return [];
  return Array.isArray(data.menuItem) ? data.menuItem : [data.menuItem];
}

/**
 * Best-effort match of a decoded VIN to an EPA test record. fueleconomy.gov
 * has no VIN lookup of its own, so this walks its year -> make -> model ->
 * options menus, matching on the decoded model name and (if available)
 * cylinder count / displacement to disambiguate trims.
 * @returns {Promise<{fuelKind: 'gas'|'ev', fuelType: string|null, combinedMpg: number|null, efficiencyMiPerKwh: number|null}|null>}
 */
export async function findEpaEfficiency({ make, model, year, cylinders, displacementL }) {
  const models = await fetchMenu('model', { year, make });
  const modelMatch = models.find((m) => m.text.toLowerCase().startsWith(model.toLowerCase())) ?? models[0];
  if (!modelMatch) return null;

  const options = await fetchMenu('options', { year, make, model: modelMatch.text });
  if (!options.length) return null;

  let optionMatch = options[0];
  if (cylinders || displacementL) {
    optionMatch =
      options.find(
        (o) =>
          (!cylinders || o.text.includes(`${cylinders} cyl`)) &&
          (!displacementL || o.text.includes(`${displacementL.toFixed(1)} L`))
      ) ?? optionMatch;
  }

  const res = await fetch(`${FE_BASE}/${optionMatch.value}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const v = await res.json();
  const isEv = v.atvType === 'EV' || v.fuelType1 === 'Electricity';
  const combE = parseFloat(v.combE);
  return {
    fuelKind: isEv ? 'ev' : 'gas',
    fuelType: v.fuelType1 || null,
    combinedMpg: isEv ? null : parseFloat(v.comb08) || null,
    efficiencyMiPerKwh: isEv && combE ? Math.round((100 / combE) * 10) / 10 : null,
  };
}
