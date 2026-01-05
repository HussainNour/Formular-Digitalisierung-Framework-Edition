import './App.css';
import { BrowserRouter, Routes, Route, Navigate, Link as RouterLink } from 'react-router-dom';

import { Header } from './components/Header';
import ManagerLogin from './components/ManagerLogin';

// Zuarbeit
import { JsonFormsDemo } from './components/JsonFormsDemo';
import { ZuarbeitEditor } from './components/ZuarbeitEditor';

// Dozenten
import { JsonFormsDozenten } from './components/jsonFormsDozenten';
import { DozentenEditor } from './components/DozentenEditor';

// Autofill-Module
import { AutofillManager } from './components/AutofillManager';


// Kleine Übersicht direkt in dieser Datei
import { Box, Card, CardActionArea, CardContent, Typography, Grid } from '@mui/material';

const Tile = ({ to, title, desc }: { to: string; title: string; desc: string }) => (
  <Card>
    <CardActionArea component={RouterLink} to={to}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {desc}
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
);

const Overview = () => (
  <Box sx={{ maxWidth: 1100, mx: 'auto', p: 2 }}>
    <Typography variant="h5" sx={{ mb: 2 }}>
      Übersicht
    </Typography>
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Tile
          to="/zuarbeit"
          title="Zuarbeit"
          desc="Komplette Liste & Editor der Zuarbeitsblätter"
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Tile
          to="/dozenten"
          title="Dozenten"
          desc="Komplette Liste & Editor der Dozentenblätter"
        />
      </Grid>

      {/* NEU: Autofill-Module */}
      <Grid item xs={12} md={6}>
        <Tile
          to="/autofill"
          title="Autofill-Module"
          desc="Modulliste für automatische Vorbelegung bearbeiten"
        />
      </Grid>
    </Grid>
  </Box>
);

const App = () => {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        {/* Übersicht */}
        <Route path="/" element={<Overview />} />

        {/* Zuarbeit */}
        <Route path="/zuarbeit" element={<JsonFormsDemo />} />
        <Route path="/zuarbeit/:id" element={<ZuarbeitEditor />} />

        {/* Dozenten */}
        <Route path="/dozenten" element={<JsonFormsDozenten />} />
        <Route path="/dozenten/:id" element={<DozentenEditor />} />

        {/* NEU: Autofill-Module */}
        <Route path="/autofill" element={<AutofillManager />} />

        {/* Login */}
        <Route path="/login" element={<ManagerLogin />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
