import React, { useState, useMemo } from 'react';
import { JsonForms } from '@jsonforms/react';
import { materialCells, materialRenderers } from '@jsonforms/material-renderers';

import autofillSchema from '../schemaAutofill.json';
import autofillUiSchema from '../uischemaAutofill.json';

// deine bestehende Autofill-Datei:
import modulesJson from '../../config/INB_module.json';

import {
  Box,
  Button,
  Stack,
  Alert,
  Typography,
  Divider
} from '@mui/material';

/** Typen grob – du kannst sie bei Bedarf genauer machen */
type AutofillModule = (typeof modulesJson)[number];
type AutofillModel = AutofillModule[];

/** Hilfsfunktion: JSON herunterladen */
const downloadJson = (obj: any, filename: string) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Fehlergrenze für JsonForms – zeigt UI statt einfach „weißem Bildschirm“ */
type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; message?: string };

class JsonFormsErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    console.error('❌ JsonForms ErrorBoundary caught error:', error);
    return {
      hasError: true,
      message: error?.message ?? String(error)
    };
  }

  componentDidCatch(error: any, info: any) {
    console.error('❌ JsonForms Error details:', { error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Fehler beim Rendern des Formulars
          </Typography>
          <Typography variant="body2">
            {this.state.message || 'Unbekannter Fehler innerhalb von JsonForms.'}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Details findest du in der Browser-Konsole (F12 → Console).
          </Typography>
        </Alert>
      );
    }
    return this.props.children;
  }
}

export const AutofillManager = () => {
  console.log('🔧 AutofillManager RENDER');

  // ================== Rohdaten-Check ==================
  const isArray = Array.isArray(modulesJson);
  const initialLength = isArray ? (modulesJson as AutofillModel).length : 0;

  console.log('🔧 modulesJson type:', typeof modulesJson);
  console.log('🔧 modulesJson isArray:', isArray, 'length:', initialLength);

  const [data, setData] = useState<AutofillModel>(
    isArray ? (modulesJson as AutofillModel) : []
  );
  const [hasErrors, setHasErrors] = useState(false);
  const [status, setStatus] = useState<'idle' | 'exported'>('idle');

  const handleChange = ({ data: next, errors }: { data: any; errors?: any[] }) => {
    console.log('🔧 JsonForms onChange – errors:', errors?.length ?? 0);
    setData((next ?? []) as AutofillModel);
    setHasErrors((errors?.length ?? 0) > 0);
  };

  const reset = () => {
    console.log('🔧 Reset auf Originaldaten');
    setData(isArray ? (modulesJson as AutofillModel) : []);
    setStatus('idle');
  };

  const handleExport = () => {
    console.log('🔧 Export als JSON; Einträge:', data?.length ?? 0);
    downloadJson(data, 'INB_module.json');
    setStatus('exported');
    setTimeout(() => setStatus('idle'), 1000);
  };

  // ================== Debug-Infos für die UI ==================
  const debugInfo = useMemo(() => {
    const first = isArray && initialLength > 0 ? (modulesJson as AutofillModel)[0] : undefined;

    return {
      isArray,
      initialLength,
      firstKeys: first ? Object.keys(first) : [],
      dataLength: Array.isArray(data) ? data.length : NaN,
      schemaType: (autofillSchema as any)?.type,
      uiType: (autofillUiSchema as any)?.type
    };
  }, [isArray, initialLength, data]);

  const jsonFormsKannRendern = debugInfo.isArray && debugInfo.schemaType === 'array';

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Autofill-Daten (Module)
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Diese Seite bearbeitet nur eine Kopie der Datei
        <code> config/INB_module.json </code> im Browser.
        Änderungen werden nicht automatisch auf dem Server gespeichert.
        Nutze &bdquo;Als JSON herunterladen&ldquo; und ersetze die Datei
        danach im Projekt.
      </Alert>

      {/* Debug-Hinweise direkt sichtbar */}
      <Alert severity={jsonFormsKannRendern ? 'success' : 'warning'} sx={{ mb: 2 }}>
        <Typography variant="subtitle2">Debug-Status Autofill</Typography>
        <Typography variant="body2">
          modulesJson: {debugInfo.isArray ? 'Array' : 'KEIN Array'} – Länge: {debugInfo.initialLength}
        </Typography>
        <Typography variant="body2">
          Schema Root-Type: {String(debugInfo.schemaType)} (erwartet: "array")
        </Typography>
        <Typography variant="body2">
          UI-Schema Root-Type: {String(debugInfo.uiType)}
        </Typography>
        {debugInfo.firstKeys.length > 0 && (
          <Typography variant="body2">
            Erste Schlüsselnamen im ersten Eintrag: {debugInfo.firstKeys.join(', ')}
          </Typography>
        )}
      </Alert>

      {!jsonFormsKannRendern && (
        <Alert severity="error" sx={{ mb: 2 }}>
          JsonForms kann nicht gerendert werden, weil entweder
          <ul>
            <li>
              <code>INB_module.json</code> kein Array ist (aktueller Typ: {String(debugInfo.isArray ? 'Array' : typeof modulesJson)})
            </li>
            <li>
              oder <code>schemaAutofill.json</code> nicht <code>{"{ type: 'array', ... }"}</code> als Root hat.
            </li>
          </ul>
          Bitte prüfe diese beiden Dateien. Details stehen außerdem in der Browser-Konsole.
        </Alert>
      )}

      {/* Nur rendern, wenn die Daten/Schemata halbwegs plausibel sind */}
      {jsonFormsKannRendern && (
        <JsonFormsErrorBoundary>
          <JsonForms
            schema={autofillSchema as any}
            uischema={autofillUiSchema as any}
            data={data}
            renderers={materialRenderers}
            cells={materialCells}
            onChange={handleChange}
            // Performance-Schalter bei vielen Einträgen
            validationMode="NoValidation"
          />
        </JsonFormsErrorBoundary>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={reset}>
          Originaldaten neu laden
        </Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={hasErrors}
        >
          Als JSON herunterladen
        </Button>
      </Stack>

      {hasErrors && (
        <Alert severity="error" sx={{ mt: 2 }}>
          JsonForms meldet Fehler im Formular – bitte korrigieren, bevor du exportierst.
          Details findest du in der Browser-Konsole (F12 → Console).
        </Alert>
      )}

      {status === 'exported' && (
        <Alert severity="success" sx={{ mt: 2 }}>
          JSON wurde erzeugt. Du kannst die Datei jetzt in
          <code> config/INB_module.json </code> ersetzen.
        </Alert>
      )}

      <Divider sx={{ mt: 3, mb: 1 }} />

      {/* zusätzliche Debug-Section */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Debug-Infos (nur zur Fehlersuche)
      </Typography>
      <Typography variant="body2">
        Aktuelle Datenlänge im State: {debugInfo.dataLength}
      </Typography>
      <Typography variant="body2">
        Schau in der Konsole nach Logs mit dem Präfix <code>🔧</code> und Fehlermeldungen mit <code>❌</code>.
      </Typography>
    </Box>
  );
};
