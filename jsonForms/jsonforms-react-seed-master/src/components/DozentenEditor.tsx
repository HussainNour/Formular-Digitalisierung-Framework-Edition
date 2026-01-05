// components/DozentenEditor.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { JsonForms } from '@jsonforms/react';
import { materialCells, materialRenderers } from '@jsonforms/material-renderers';
import { rankWith, and, schemaMatches, uiTypeIs, scopeEndsWith } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';

import schemaAll from '../schema_dozenten.json';
import uischemaAll from '../uischema_dozenten.json';

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

const API = 'http://localhost:5050/Dozenten';

/* --- Typen --- */
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

/* --- Utils --- */
const ensureArray = <T,>(v: any): T[] =>
  Array.isArray(v) ? (v as T[]) : v == null ? [] : [v as T];

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

/* --- Free-Solo control wie in der Liste --- */
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

/* --- Modul-Autofill --- */
import modulesJson from '../../config/INB_module.json';
type RawMod = any;

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

const modulnrOptions = (modulesJson as RawMod[])
  .map((m) => ({
    value: String(m['Modulnummer']).trim(),
    label: `${String(m['Modulnummer']).trim()} – ${String(m['Modulbezeichnung']).trim()}`
  }))
  .filter((o) => o.value);

/* --- Komponente --- */
export const DozentenEditor = () => {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'notfound'
  >('idle');

  // Aus Array-Schema Detail herausholen
  const itemSchema = (schemaAll as any)?.items ?? schemaAll;
  const itemUi = (uischemaAll as any)?.options?.detail ?? uischemaAll;

  const renderers = useMemo(
    () => [
      ...materialRenderers,
      {
        tester: freeSoloTester,
        renderer: (p: any) => <FreeSoloModulnrControl {...p} options={modulnrOptions} />
      }
    ],
    []
  );

  const load = async () => {
    if (!id) return;
    try {
      setStatus('loading');
      const res = await fetch(`${API}/${encodeURIComponent(id)}`);
      if (res.ok) {
        const raw = await res.json();
        const one = normalizeForLoad(raw);
        setItem(one);
        setStatus('idle');
        return;
      }
      const resAll = await fetch(API);
      if (!resAll.ok) throw new Error('HTTP ' + resAll.status);
      const arr = await resAll.json();
      const found = (Array.isArray(arr) ? arr : [arr]).find((x: any) => x?.id === id);
      if (!found) {
        setStatus('notfound');
        return;
      }
      setItem(normalizeForLoad(found));
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Mini-Autofill: wenn in der UI modulnr geändert wird, modulname/SWS etc. nachziehen
  // und laufende Nummer (nummer) automatisch vergeben.
  const onChange = ({ data }: { data: any }) => {
    const next = data as Item;
    const rows = next?.dozent?.lehrveranstaltung ?? [];

    const patched = rows.map((lv: LV, index: number) => {
      const nr = lv?.modulnr?.trim();
      let nextLv: LV = lv ?? {};
      if (nr) {
        const rawMod = (modulesJson as RawMod[]).find(
          (m) => String(m['Modulnummer']).trim() === nr
        );
        if (rawMod) {
          nextLv = { ...nextLv, ...mapModuleToLv(rawMod) };
        }
      }
      const expectedLfd = String(index + 1);
      if (nextLv.nummer !== expectedLfd) {
        nextLv = { ...nextLv, nummer: expectedLfd };
      }
      return nextLv;
    });

    if (rows.length) next.dozent!.lehrveranstaltung = patched;
    setItem(next);
  };

  const save = async () => {
    if (!item || !item.id) return;
    try {
      setStatus('saving');
      const body = JSON.stringify(trimStringsDeep(item));
      const res = await fetch(`${API}/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (!res.ok) throw new Error('PUT');
      const saved = await res.json().catch(() => item);
      setItem(normalizeForLoad(saved));
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 900);
    } catch {
      setStatus('error');
    }
  };

  if (status === 'notfound') {
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Datensatz nicht gefunden (ID: {id})
        </Alert>
        <Button component={RouterLink} to="/dozenten" variant="outlined">
          Zurück zur Übersicht
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Dozentenblatt bearbeiten</Typography>
        <Link component={RouterLink} to="/dozenten">
          Zur Übersicht
        </Link>
      </Stack>

      {item && (
        <JsonForms
          schema={itemSchema as any}
          uischema={itemUi as any}
          data={item}
          renderers={renderers}
          cells={materialCells}
          onChange={onChange}
        />
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button variant="contained" onClick={save} disabled={!item || status === 'saving'}>
          Speichern
        </Button>
        <Button variant="outlined" onClick={load} disabled={status === 'loading'}>
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
    </Box>
  );
};
