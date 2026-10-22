// Hand edits for Palmetto Bay (baked from seed 396873 on the "town" grid), applied on top of base.js when it loads.
// This is where the map stops being "a seed" and becomes a place: names, roles, the start, later moved or removed
// buildings. Keep every edit here (never in base.js) so the base can be re-baked.

// Neighbourhoods by area of town (the downtown core in the middle).
const HOODS = { core: 'Downtown', nw: 'Old Town', ne: 'Riverside', sw: 'Sunset Flats', se: 'Railside' };

export default function edits(city) {
  const cx = city.sizeX / 2, cz = city.sizeZ / 2;
  city.town = { name: 'Palmetto Bay', places: [] };
  city.district = { ...city.district, name: 'Palmetto Bay' };
  const place = (role, name, x, z, extra = {}) => { const p = { role, name, x, z, ...extra }; city.town.places.push(p); return p; };

  // Neighbourhood of every block.
  for (const b of city.blocks) {
    const dx = b.center.x - cx, dz = b.center.z - cz;
    b.hood = Math.hypot(dx, dz) < city.layout.size * 0.24 ? HOODS.core : HOODS[(dz < 0 ? 'n' : 's') + (dx < 0 ? 'w' : 'e')];
  }
  for (const b of city.turf.blocks) b.hood = city.blocks[b.id].hood; // the sim reads the turf copy

  // Civic sites: City Hall (the generator's), a police station and the clinics.
  const civic = city.blocks.filter((b) => b.zone === 'civic');
  const hall = city.turf.civic;
  place('cityHall', 'The White House', hall.x, hall.z, { block: hall.block });
  const pd = civic.find((b) => b.id !== hall.block);
  if (pd) place('police', 'Palmetto Bay PD, 1st Precinct', pd.center.x, pd.center.z, { block: pd.id });
  for (const c of city.businesses.filter((b) => b.type === 'clinic')) place('clinic', c.name, c.capture.x, c.capture.z, { business: c.id });

  // The hero's base: the first headquarters warehouse becomes "The Lighthouse"; the other warehouses are the gangs'
  // hideouts.
  for (const w of city.warehouses) {
    if (w.hq === 0) { w.name = 'The Lighthouse'; w.role = 'heroBase'; place('heroBase', w.name, w.safe.x, w.safe.z, { warehouse: w.id }); }
    else { w.role = 'hideout'; place('hideout', w.name, w.safe.x, w.safe.z, { warehouse: w.id }); }
  }

  // Start: on the street in front of City Hall, facing it.
  const cell = city.layout.cells.find((c) => c.block === hall.block);
  if (cell) {
    const r = cell.rect, S = city.district.roads.street;
    city.spawn = { x: (r.x0 + r.x1) / 2 - 6, y: 0.3, z: r.z1 + S * 0.55, yaw: 0 };
  }
  return city;
}
