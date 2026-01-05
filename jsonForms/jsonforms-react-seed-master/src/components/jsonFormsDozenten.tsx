// components/jsonFormsDozenten.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { JsonForms } from '@jsonforms/react';
import { rankWith, and, schemaMatches, uiTypeIs, scopeEndsWith } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { materialCells, materialRenderers } from '@jsonforms/material-renderers';

import schema from '../schema_dozenten.json';
import uischema from '../uischema_dozenten.json';

import {
  Box,
  Button,
  Alert,
  Stack,
  Typography,
  TextField,
  Autocomplete,
  Link
} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import { Link as RouterLink } from 'react-router-dom';
import { fetchAuth, getToken } from '../auth';

/** ----- Typen ----- */
type LV = {
  nummer?: string;
  fakultaet?: string;
  studiengang?: string;
  fs?: string;
  gruppen?: string;
  modulnr?: string;
  modulname?: string;
  swsVorlesung?: string;
  swsSeminar?: string;
  swsPraktikum?: string;
  digital?: string;
  bemerkung?: string;
};

type Sperr = { wochen?: string; wochentag?: string; uhrzeit?: string; begruendung?: string };
type Einsatz = { wochen?: string; wochentag?: string; uhrzeit?: string; anmerkung?: string };

type Doz = {
  titel?: string;
  vorname?: string;
  nachname?: string;
  fakultaet?: string;
  arbeitszeit?: string;
  vollzeitInput?: string;
  email?: string;
  telefon?: string;
  dozentHinweise?: string;
  dekanatHinweise?: string;
  profUnterschrift?: string;
  dekanUnterschrift?: string;
  datumUnterschrift?: string;
  dozententag?: string;
  forschungstag?: string;
  ausnahmeTag?: string;
  sperrzeit?: Sperr[];
  einsatzzeit?: Einsatz[];
  lehrveranstaltung?: LV[];
};

type Item = { id?: string; dozent?: Doz };
type Model = Item[];

/** ----- API ----- */
const API = 'http://localhost:5050/Dozenten';

/** ----- externe Modulquelle ----- */
import modulesJson from '../../config/INB_module.json';
type RawMod = any;

/** ----- Utils ----- */
const ensureArray = <T,>(v: any): T[] =>
  Array.isArray(v) ? (v as T[]) : v == null ? [] : [v as T];

const trimStringsDeep = (obj: any): any => {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(trimStringsDeep);
  if (typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) out[k] = trimStringsDeep(v);
    return out;
  }
  return typeof obj === 'string' ? obj.trim() : obj;
};

const normalizeItem = (it: Item): Item => {
  const doz = it?.dozent ?? {};
  return trimStringsDeep({
    ...it,
    dozent: {
      ...doz,
      sperrzeit: ensureArray<Sperr>(doz.sperrzeit),
      einsatzzeit: ensureArray<Einsatz>(doz.einsatzzeit),
      lehrveranstaltung: ensureArray<LV>(doz.lehrveranstaltung)
    }
  });
};

const normalizeForLoad = (inObj: any): Item => {
  const id = inObj?.id ?? undefined;
  const doz = inObj?.dozent ?? {};
  return {
    id,
    dozent: {
      ...doz,
      sperrzeit: ensureArray<Sperr>(doz.sperrzeit),
      einsatzzeit: ensureArray<Einsatz>(doz.einsatzzeit),
      lehrveranstaltung: ensureArray<LV>(doz.lehrveranstaltung)
    }
  };
};

/** ----- Stabile IDs: nachname-vorname__<semester> ----- */
const toSlug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Ää]/g, 'ae')
    .replace(/[Öö]/g, 'oe')
    .replace(/[Üü]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const computeSemesterFromDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 4 && m <= 9 ? { kind: 'SoSe' as const, year: y } : { kind: 'WiSe' as const, year: y };
};

const nextSemester = (sem = computeSemesterFromDate()) =>
  sem.kind === 'SoSe'
    ? ({ kind: 'WiSe' as const, year: sem.year })
    : ({ kind: 'SoSe' as const, year: sem.year + 1 });

const yy = (y: number) => String(y % 100).padStart(2, '0');

const formatSemesterForId = (sem: { kind: 'SoSe' | 'WiSe'; year: number }) =>
  sem.kind === 'WiSe' ? `wise${yy(sem.year)}${yy(sem.year + 1)}` : `sose${sem.year}`;

const computeStableId = (it: Item): string | undefined => {
  const v = it?.dozent?.vorname?.trim() ?? '';
  const n = it?.dozent?.nachname?.trim() ?? '';
  if (!v || !n) return undefined;
  const sem = formatSemesterForId(nextSemester(computeSemesterFromDate()));
  return `${toSlug(n)}-${toSlug(v)}__${sem}`;
};

const assignIdsIfMissing = (items: Model, existingIds: Set<string>): Model => {
  const used = new Set<string>([
    ...existingIds,
    ...((items.map((i) => i.id).filter(Boolean)) as string[])
  ]);
  const out: Model = [];
  for (const it of items) {
    if (it.id && String(it.id).trim() !== '') {
      out.push(it);
      continue;
    }
    const base = computeStableId(it);
    if (!base) {
      out.push(it);
      continue;
    }
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) candidate = `${base}-${i++}`;
    used.add(candidate);
    out.push({ ...it, id: candidate });
  }
  return out;
};

/** ----- Modul-Autofill (für lehrveranstaltung[].modulnr) ----- */
const mapModuleToLv = (mod: RawMod) => {
  if (!mod) return {};
  const swsV = mod?.Lehrveranstaltungen?.SWS_V ?? '';
  const swsS = mod?.Lehrveranstaltungen?.SWS_S ?? '';
  const swsP = mod?.Lehrveranstaltungen?.SWS_P ?? '';
  return {
    fakultaet: mod?.['Fakultät'] ?? '',
    studiengang: Array.isArray(mod?.ZusammenMit) ? mod.ZusammenMit.join(', ') : '',
    fs: mod?.['Fachsemester'] ?? '',
    modulname: mod?.['Modulbezeichnung'] ?? '',
    swsVorlesung: swsV !== '' ? String(swsV) : '',
    swsSeminar: swsS !== '' ? String(swsS) : '',
    swsPraktikum: swsP !== '' ? String(swsP) : ''
  };
};

/** Welche LV-Felder sollen automatisch aus dem Modul übernommen werden? */
const LV_AUTO_KEYS: (keyof LV)[] = [
  'fakultaet',
  'studiengang',
  'fs',
  'modulname',
  'swsVorlesung',
  'swsSeminar',
  'swsPraktikum'
];

const mergeLvAutoFill = (oldLv: LV, auto: Partial<LV>): LV => {
  const next: LV = { ...oldLv };
  for (const k of LV_AUTO_KEYS) {
    const v = (auto as any)[k];
    if (v !== undefined) {
      (next as any)[k] = v;
    }
  }
  return next;
};

/** ---------- Programme/Gruppen (wie im ersten Code, aber für LV) ---------- */
const extractProgramsFromLv = (lv?: LV): string[] => {
  const s = (lv?.studiengang ?? '').toUpperCase();
  const set = new Set<string>();
  if (/\bINB\b/.test(s)) set.add('INB');
  if (/\bMIB\b/.test(s)) set.add('MIB');
  return set.size ? Array.from(set) : ['INB', 'MIB'];
};

const computeGruppenForNextSemester = (lv?: LV): string => {
  const sem = nextSemester(computeSemesterFromDate());
  const programs = extractProgramsFromLv(lv);
  const cohorts: number[] =
    sem.kind === 'WiSe'
      ? [sem.year + 1, sem.year, sem.year - 1]
      : [sem.year, sem.year - 1];

  const parts: string[] = [];
  for (const prog of programs) {
    for (const c of cohorts) parts.push(`${prog}${yy(c)}`);
  }
  return parts.join(' + ');
};

/** Dozent:innen-Daten aus Modul (Modulverantwortliche) holen */
type LecturerInfo = { titel?: string; vorname?: string; nachname?: string };

const extractLecturerFromModule = (mod: RawMod): LecturerInfo => {
  if (!mod) return {};
  const mv = mod?.Modulverantwortliche || {};
  const titel = String(mv.Anrede ?? '').trim();
  const vor = String(mv.Vorname ?? '').trim();
  const nach = String(mv.Nachname ?? '').trim();

  return {
    titel: titel || undefined,
    vorname: vor || undefined,
    nachname: nach || undefined
  };
};

/** ----- Free-Solo Autocomplete für modulnr (auch in Arrays) ----- */
type FSProps = {
  data: any;
  handleChange: (path: string, value: any) => void;
  path: string;
  label?: string;
  enabled?: boolean;
  options?: any;
};

const FreeSoloModulnrControlBase = (
  props: FSProps & { options: { value: string; label: string }[] }
) => {
  const { data, handleChange, path, label, enabled = true, options } = props;
  const labelMap = useMemo(
    () => new Map(options.map((o: any) => [o.value, o.label])),
    [options]
  );
  const allValues = useMemo(() => options.map((o: any) => o.value), [options]);
  const filterOptions = useMemo(
    () =>
      createFilterOptions<string>({
        stringify: (opt) => `${opt} ${labelMap.get(opt) ?? ''}`
      }),
    [labelMap]
  );

  return (
    <Autocomplete<string, false, false, true>
      freeSolo
      disabled={!enabled}
      options={allValues}
      filterOptions={filterOptions}
      value={data ?? ''}
      isOptionEqualToValue={(opt, val) => opt === val}
      onChange={(_, val) => handleChange(path, typeof val === 'string' ? val : '')}
      onInputChange={(_, val, reason) => {
        if (reason !== 'reset') handleChange(path, val ?? '');
      }}
      getOptionLabel={(opt) => String(opt ?? '')}
      renderOption={(liProps, option) => (
        <li {...liProps} key={option}>
          {labelMap.get(option) ?? option}
        </li>
      )}
      renderInput={(params) => (
        <TextField {...params} label={label ?? 'Modulnummer'} variant="outlined" />
      )}
    />
  );
};

const FreeSoloModulnrControl = withJsonFormsControlProps(FreeSoloModulnrControlBase);

const freeSoloTester = rankWith(
  5,
  and(
    uiTypeIs('Control'),
    scopeEndsWith('modulnr'),
    schemaMatches((s) => (s as any)?.type === 'string')
  )
);

/** ----- Komponente ----- */
export const JsonFormsDozenten = () => {
  const [data, setData] = useState<Model>([]);
  const [hasErrors, setHasErrors] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>(
    'idle'
  );

  const idRef = useRef<(string | undefined)[]>([]);
  const lvModNrRef = useRef<string[][]>([]); // letzte modulnr pro LV-Zeile (zum Erkennen von Änderungen)

  /** Map Modulnummer -> Modul-Objekt */
  const moduByNr = useMemo(() => {
    const m = new Map<string, RawMod>();
    for (const mod of modulesJson as RawMod[]) {
      const key = String(mod?.['Modulnummer'] ?? '').trim();
      if (key) m.set(key, mod);
    }
    return m;
  }, []);

  const modulnrOptions = useMemo(
    () =>
      (modulesJson as RawMod[])
        .map((m) => ({
          value: String(m['Modulnummer']).trim(),
          label: `${String(m['Modulnummer']).trim()} – ${String(
            m['Modulbezeichnung']
          ).trim()}`
        }))
        .filter((o) => o.value),
    []
  );

  const renderers = useMemo(
    () => [
      ...materialRenderers,
      {
        tester: freeSoloTester,
        renderer: (p: any) => <FreeSoloModulnrControl {...p} options={modulnrOptions} />
      }
    ],
    [modulnrOptions]
  );

  const haveToken = !!getToken();

  const load = async () => {
    try {
      setStatus('loading');
      const res = await fetchAuth(API);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.json();
      const items: Item[] = (Array.isArray(raw) ? raw : [raw])
        .filter(Boolean)
        .map(normalizeForLoad);
      setData(items);
      idRef.current = items.map((it) => it?.id);
      // init ref für LV-Modulnummern
      lvModNrRef.current = items.map(
        (it) => (it?.dozent?.lehrveranstaltung ?? []).map((lv) => lv?.modulnr?.trim() ?? '')
      );
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    if (haveToken) load();
  }, [haveToken]);

  const save = async () => {
    if (hasErrors) return;
    try {
      setStatus('saving');

      const existingRes = await fetchAuth(API);
      const existing: any[] = existingRes.ok ? await existingRes.json() : [];
      const existingIds = new Set((existing ?? []).map((e) => e?.id).filter(Boolean));

      let working: Model = data ?? [];
      working = assignIdsIfMissing(working, existingIds);

      const currentIds = new Set((working ?? []).map((b) => b.id).filter(Boolean) as string[]);
      const toDelete = Array.from(existingIds).filter((id) => !currentIds.has(id as string));
      await Promise.all(
        toDelete.map((id) =>
          fetchAuth(`${API}/${encodeURIComponent(id as string)}`, { method: 'DELETE' }).then(
            (r) => {
              if (!r.ok) throw new Error('DELETE');
            }
          )
        )
      );

      const updated: Model = [];
      for (const item of working ?? []) {
        const bodyObj = normalizeItem(item);
        const body = JSON.stringify(bodyObj);

        if (item.id && existingIds.has(item.id)) {
          const res = await fetchAuth(`${API}/${encodeURIComponent(item.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body
          });
          if (!res.ok) throw new Error('PUT');
          const saved = await res.json().catch(() => bodyObj);
          updated.push(saved);
        } else {
          const res = await fetchAuth(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
          });
          if (!res.ok) throw new Error('POST');
          const created = await res.json().catch(() => ({}));
          const effectiveId = item.id ?? (created as any)?.id;
          updated.push({ ...bodyObj, id: effectiveId });
        }
      }

      setData(updated.map(normalizeItem));
      idRef.current = updated.map((it) => it?.id);
      // LV-Refs neu setzen
      lvModNrRef.current = updated.map(
        (it) => (it?.dozent?.lehrveranstaltung ?? []).map((lv) => lv?.modulnr?.trim() ?? '')
      );
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 900);
    } catch {
      setStatus('error');
    }
  };

  /** jsonforms onChange */
  const handleChange = ({ data: next, errors }: { data: any; errors?: any[] }) => {
    setData(next as Model);
    setHasErrors((errors?.length ?? 0) > 0);
  };

  /**
   * Auto-Fill pro Lehrveranstaltung, wenn modulnr geändert wurde
   * - LV-Felder aus Modul-JSON
   * - laufende Nummer (lfd / nummer)
   * - Gruppen: nur EINMAL beim ersten Setzen der Modulnummer, danach frei editierbar
   * - Dozent:innen-Daten (titel, vorname, nachname) aus Modulverantwortliche,
   *   falls beim Dozenten noch leer
   */
  useEffect(() => {
    const src: Model = data ?? [];
    let changedAny = false;

    const patched: Model = src.map((item, idxItem) => {
      const doz = item?.dozent;
      const arr = doz?.lehrveranstaltung ?? [];
      const lastRow = lvModNrRef.current[idxItem] ?? [];

      let lecturerFromFirstMod: LecturerInfo | null = null;
      let changedItem = false;

      const nextRows: LV[] = arr.map((lv, idxLv) => {
        const curNr = lv?.modulnr?.trim() ?? '';
        const prevNr = lastRow[idxLv] ?? '';
        let nextLv: LV = lv ?? {};

        // Modulwechsel -> Auto-Fill für LV + Dozent:innen-Infos merken
        if (curNr && curNr !== prevNr) {
          const rawMod = moduByNr.get(curNr);
          if (rawMod) {
            const auto = mapModuleToLv(rawMod);
            nextLv = mergeLvAutoFill(nextLv, auto);
            if (!lecturerFromFirstMod) {
              lecturerFromFirstMod = extractLecturerFromModule(rawMod);
            }
            changedItem = true;
          }
        }

        // Gruppen nur EINMAL berechnen:
        // wenn vorher keine Modulnummer (prevNr leer) und jetzt eine gesetzt wurde (curNr)
        // UND das Gruppenfeld noch leer ist -> Vorschlag eintragen
        const gruppenEmpty = !lv?.gruppen || lv.gruppen.trim() === '';
        if (!prevNr && curNr && gruppenEmpty) {
          const suggested = computeGruppenForNextSemester(nextLv);
          if (suggested && suggested !== nextLv.gruppen) {
            nextLv = { ...nextLv, gruppen: suggested };
            changedItem = true;
          }
        }

        // laufende Nummer (1,2,3,...) setzen
        const expectedLfd = String(idxLv + 1);
        if (nextLv.nummer !== expectedLfd) {
          nextLv = { ...nextLv, nummer: expectedLfd };
          changedItem = true;
        }

        return nextLv;
      });

      // Dozent:innen-Stammdaten nur setzen, wenn noch leer und wir aus irgendeinem Modul was haben
      let nextDoz = doz ?? {};
      if (lecturerFromFirstMod) {
        const maybe = { ...nextDoz };
        let filled = false;

        if (!maybe.titel && lecturerFromFirstMod.titel) {
          maybe.titel = lecturerFromFirstMod.titel;
          filled = true;
        }
        if (!maybe.vorname && lecturerFromFirstMod.vorname) {
          maybe.vorname = lecturerFromFirstMod.vorname;
          filled = true;
        }
        if (!maybe.nachname && lecturerFromFirstMod.nachname) {
          maybe.nachname = lecturerFromFirstMod.nachname;
          filled = true;
        }

        if (filled) {
          nextDoz = maybe;
          changedItem = true;
        }
      }

      if (changedItem) {
        changedAny = true;
        return {
          ...item,
          dozent: {
            ...nextDoz,
            lehrveranstaltung: nextRows
          }
        };
      }
      return item;
    });

    if (changedAny) {
      setData(patched);
      lvModNrRef.current = patched.map((it) =>
        (it?.dozent?.lehrveranstaltung ?? []).map((lv) => lv?.modulnr?.trim() ?? '')
      );
    } else {
      lvModNrRef.current = (data ?? []).map((it) =>
        (it?.dozent?.lehrveranstaltung ?? []).map((lv) => lv?.modulnr?.trim() ?? '')
      );
    }
  }, [data, moduByNr]);

  /** IDs wieder einsetzen, falls JsonForms sie verliert */
  useEffect(() => {
    const src: Model = data ?? [];
    let needPatch = false;
    const patched = src.map((it, idx) => {
      if (!it) return it;
      if (it.id) return it;
      const remembered = idRef.current[idx];
      if (!remembered) return it;
      needPatch = true;
      return { ...it, id: remembered };
    });
    if (needPatch) setData(patched);
    else idRef.current = src.map((it) => it?.id);
  }, [data]);

  const buildShareUrl = (id: string) =>
    `${window.location.origin}/dozenten/${encodeURIComponent(id)}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Link kopiert ✅');
    } catch {
      // Fallback z. B. in unsicheren Kontexten
      // eslint-disable-next-line no-alert
      prompt('Zum Kopieren STRG+C drücken und Enter:', text);
    }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Dozenten (Array)
      </Typography>

      {!haveToken && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Du bist nicht eingeloggt. <a href="/login">Zum Manager-Login</a>
        </Alert>
      )}

      <JsonForms
        schema={schema as any}
        uischema={uischema as any}
        data={data}
        renderers={[...renderers]}
        cells={materialCells}
        onChange={handleChange}
      />

      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={save}
          disabled={!haveToken || hasErrors || status === 'saving'}
        >
          Speichern
        </Button>
        <Button
          variant="outlined"
          onClick={load}
          disabled={!haveToken || status === 'loading'}
        >
          Neu laden
        </Button>
      </Stack>

      {status === 'loading' && (
        <Alert sx={{ mt: 2 }} severity="info">
          Lade…
        </Alert>
      )}
      {status === 'saving' && (
        <Alert sx={{ mt: 2 }} severity="info">
          Speichere…
        </Alert>
      )}
      {status === 'saved' && (
        <Alert sx={{ mt: 2 }} severity="success">
          Gespeichert
        </Alert>
      )}
      {status === 'error' && (
        <Alert sx={{ mt: 2 }} severity="error">
          Fehler beim Laden/Speichern
        </Alert>
      )}

      {/* Share-Links */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Share-Links (nur Einzel-Editor)
        </Typography>
        {!data?.length && (
          <Typography variant="body2" color="text.secondary">
            Keine Einträge vorhanden.
          </Typography>
        )}
        <ul style={{ marginTop: 8 }}>
          {(data ?? []).map((it, idx) => {
            const id = it?.id?.trim();
            const linkPath = id ? `/dozenten/${encodeURIComponent(id)}` : '';
            const fullUrl = id ? buildShareUrl(id) : '';
            const label =
              `${it?.dozent?.nachname ?? 'Eintrag'} ${it?.dozent?.vorname ?? ''}`.trim() ||
              `Eintrag ${idx + 1}`;
            return (
              <li key={idx} style={{ marginBottom: 6 }}>
                {id ? (
                  <>
                    <Link component={RouterLink} to={linkPath}>
                      {label} — {id}
                    </Link>{' '}
                    <Button size="small" onClick={() => copyToClipboard(fullUrl)}>
                      Link kopieren
                    </Button>
                  </>
                ) : (
                  <em>(ohne ID – erst speichern)</em>
                )}
              </li>
            );
          })}
        </ul>
      </Box>
    </Box>
  );
};
